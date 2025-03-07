import request from '@/utils/fetch';
import { method } from 'lodash';
type ComponentInfoParams = {
  id: string;
};
export const getComponentInfo = async (params: ComponentInfoParams) => {
  return await request(`/api/componentInfo?id=${params.id}`);
};

type FileContentParams = {
  id: string;
  fileName: string;
};
export const getFileContent = async (params: FileContentParams) => {
  return await request(
    `/api/fileContent?scope=${params.id}&fileName=${params.fileName}`,
  );
};

type PackageParseParams = {
  filePath: string;
};
export const packageParse = async (params: PackageParseParams) => {
  return await request(`/api/packageParse?filePath=${params.filePath}`);
};

type AddComponentInfo = {};
export const addComponentInfo = async (params: AddComponentInfo) => {
  return await request(`/api/componentInfo`, {
    method: 'POST',
    body: params,
  });
};

type GetComponentList = {};
export const getComponentList = async (params?: GetComponentList) => {
  return await request(`/api/componentList`);
};

type ParseCssToObject = {
  fileContent: string;
};
export const parseCssToObject = async (params: ParseCssToObject) => {
  return await request(`/api/fileParse/cssParseToObject`, {
    method: 'POST',
    body: params,
  });
};

type Auth = {};
export const auth = async (params?: Auth) => {
  return await request(`/api/auth`, {
    method: 'GET',
  });
};
