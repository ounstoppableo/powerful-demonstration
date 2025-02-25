'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  selectComponentInfo,
  setComponentInfo,
} from '@/store/component-info/component-info-slice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '@/store/hooks';
import { isEqual } from 'lodash';
import parseToComponent from '@/utils/parseStringForComponent/parseToComponent';

(window as any).React = React;

function useDeepCompareEffect(
  callback: (...params: any) => any,
  dependencies: any[],
) {
  const prevDeps = useRef<any>(null);

  if (!isEqual(prevDeps.current, dependencies)) {
    prevDeps.current = dependencies;
    callback();
  }
}

export default function Viewer() {
  const [root, setRoot] = useState(null);
  const dispatch = useDispatch();
  const componentInfo = useAppSelector(selectComponentInfo);
  useEffect(() => {
    window.parent.postMessage(
      { type: 'frameworkReady', data: '我准备好了~' },
      '*',
    );
    const handleMsgCb = async (e: any) => {
      if (e.data.type === 'updateViewer') {
        dispatch(setComponentInfo(e.data.viewInfo));
      }
      if (e.data.type === 'setStyle') {
        Object.keys(e.data.style).map((selector) => {
          Object.keys(e.data.style[selector]).forEach((attr) => {
            if (!document!.querySelector(selector)) return;
            (document!.querySelector(selector) as any).style[attr] =
              e.data.style[selector][attr];
          });
        });
      }
    };
    window.addEventListener('message', handleMsgCb);
    return () => {
      window.removeEventListener('message', handleMsgCb);
    };
  }, []);
  useDeepCompareEffect(async () => {
    if (componentInfo.id) {
      const components = await parseToComponent(
        componentInfo.fileContentsMap[componentInfo.entryFile],
        'root',
        componentInfo,
      );
      setRoot(components);
    }
  }, [componentInfo]);

  return (
    <>
      <div className="flex justify-center items-center w-[100vw] h-[100vh]">
        {root ? (root as any)[Object.keys(root)[0]]() : ''}
      </div>
    </>
  );
}
