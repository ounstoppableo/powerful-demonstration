import { getFileContent } from '@/app/lib/data';
import { selectComponentInfo } from '@/store/component-info/component-info-slice';
import { useAppSelector } from '@/store/hooks';
import * as acorn from 'acorn';
import { ancestor } from 'acorn-walk';
import ts from 'typescript';
(window as any).modulesMap = {};

export const clearExportKeyWords = (codeContent: string) => {
  // export { a, b, c as d };
  codeContent.match(/export\s+\{([^}]+)\};/g)?.forEach((item) => {
    codeContent = codeContent.replace(item, '');
  });
  // export { a, b } from './module';
  codeContent
    .match(/export\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"];/g)
    ?.forEach((item) => {
      codeContent = codeContent.replace(item, '');
    });
  // export { default } from './module';
  codeContent
    .match(/export\s+\{default\}\s+from\s+['"][^'"]+['"];/g)
    ?.forEach((item) => {
      codeContent = codeContent.replace(item, '');
    });
  // export * from './module';
  codeContent
    .match(/export\s+\*\s+from\s+['"][^'"]+['"];/g)
    ?.forEach((item) => {
      codeContent = codeContent.replace(item, '');
    });
  // export * as Utils from './utils.js';
  codeContent
    .match(/export\s+\*\s+as\s+([a-zA-Z_$][\w$]*)\s+from\s+['"][^'"]+['"];/g)
    ?.forEach((item) => {
      codeContent = codeContent.replace(item, '');
    });
  return codeContent
    .replace(/export\s+default\s+/g, '') // 删除 `export default`
    .replace(/export\s+({[^}]+}|\w+\s*|\w+\s*\([^)]*\)\s*|\w+\s+class)/g, '$1');
};

export const getDeclarationFromContent = (codeContent: string) => {
  const ast = acorn.parse(codeContent, {
    sourceType: 'module',
    ecmaVersion: 'latest',
  });

  // 提取所有的变量和声明
  const declarations: any = [];

  // 遍历 AST 提取变量声明、函数声明、类声明
  function extractDeclarations(node: any) {
    if (node.type === 'VariableDeclaration') {
      // 处理变量声明
      node.declarations.forEach((declaration: any) => {
        declarations.push({
          type: 'VariableDeclaration',
          name: declaration.id.name,
          kind: node.kind, // const, let, var
        });
      });
    } else if (node.type === 'FunctionDeclaration') {
      // 处理函数声明
      declarations.push({
        type: 'FunctionDeclaration',
        name: node.id.name,
      });
    } else if (node.type === 'ClassDeclaration') {
      // 处理类声明
      declarations.push({
        type: 'ClassDeclaration',
        name: node.id.name,
      });
    }
  }

  // 遍历 AST
  function traverseNode(node: any) {
    extractDeclarations(node);
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        traverseNode(node[key]);
      }
    }
  }

  // 开始遍历 AST
  traverseNode(ast);

  return declarations;
};

export const getFunctionAndReturn = (codeContent: any) => {
  const ast = acorn.parse(codeContent, {
    ecmaVersion: 2020,
    sourceType: 'module',
  });
  const results: any = [];

  function getFunctionName(node: any, ancestors: any) {
    // 查找函数的名称
    if (node.id && node.id.name) {
      return node.id.name; // 具名函数
    }

    const parent = ancestors[ancestors.length - 2]; // 获取父节点
    if (parent) {
      if (
        parent.type === 'VariableDeclarator' &&
        parent.id.type === 'Identifier'
      ) {
        return parent.id.name; // 变量赋值的函数
      }
      if (parent.type === 'Property' && parent.key.type === 'Identifier') {
        return parent.key.name; // 对象方法
      }
    }

    return '<anonymous>'; // 匿名函数
  }

  function extractReturnValue(node: any) {
    if (node.type === 'ReturnStatement' && node.argument) {
      if (node.argument.type === 'Literal') {
        return node.argument.value; // 直接返回字面量
      } else if (node.argument.type === 'BinaryExpression') {
        return '<expression>'; // 复杂表达式返回值
      } else if (node.argument.type === 'CallExpression') {
        if (
          node.argument.callee?.object?.name === 'React' &&
          node.argument.callee?.property?.name === 'createElement'
        ) {
          return '<component>';
        }
      }

      return '<non-literal>'; // 其他类型
    } else if (node.type === 'ArrowFunctionExpression' && node.body) {
      if (node.body.type === 'BlockStatement') {
        if (
          node.body.body[0].argument.callee?.object?.name === 'React' &&
          node.body.body[0].argument.callee?.property?.name === 'createElement'
        ) {
          return '<component>';
        }
      }
      if (node.body.type === 'Literal') {
        return node.body.value; // 直接返回字面量
      }
      return '<non-literal>'; // 复杂返回值
    }
    return null;
  }

  ancestor(ast, {
    FunctionDeclaration(node, ancestors) {
      const functionName = getFunctionName(node, ancestors);
      node.body.body.forEach((stmt) => {
        const returnValue = extractReturnValue(stmt);
        if (returnValue !== null) {
          results.push({ functionName, returnValue });
        }
      });
    },
    FunctionExpression(node, ancestors) {
      const functionName = getFunctionName(node, ancestors);
      node.body.body.forEach((stmt) => {
        const returnValue = extractReturnValue(stmt);
        if (returnValue !== null) {
          results.push({ functionName, returnValue });
        }
      });
    },
    ArrowFunctionExpression(node, ancestors) {
      const functionName = getFunctionName(node, ancestors);
      const returnValue = extractReturnValue(node);
      if (returnValue !== null) {
        results.push({ functionName, returnValue });
      }
    },
  });

  return results;
};

const getExportVariableFromContent = (codeContent: string) => {
  const ast = acorn.parse(codeContent, {
    sourceType: 'module',
    ecmaVersion: 'latest',
  });

  // 存储所有导出的变量和声明
  const exports: any[] = [];

  // 遍历 AST 提取导出相关的变量和声明
  function extractExports(node: any) {
    if (node.type === 'ExportNamedDeclaration') {
      // 具名导出
      if (node.declaration) {
        if (node.declaration.type === 'VariableDeclaration') {
          // 具名变量导出
          node.declaration.declarations.forEach((declaration: any) => {
            exports.push({
              type: 'VariableDeclaration',
              name: declaration.id.name,
              kind: node.declaration.kind, // const, let, var
            });
          });
        } else if (node.declaration.type === 'FunctionDeclaration') {
          // 具名函数导出
          exports.push({
            type: 'FunctionDeclaration',
            name: node.declaration.id.name,
          });
        } else if (node.declaration.type === 'ClassDeclaration') {
          // 具名类导出
          exports.push({
            type: 'ClassDeclaration',
            name: node.declaration.id.name,
          });
        }
      }
      // 处理具名导出的导入/重命名
      if (node.specifiers) {
        if (node.source) {
          node.specifiers.forEach((specifier: any) => {
            if (specifier.type === 'ExportSpecifier') {
              exports.push({
                type: 'ExportSpecifier',
                name: specifier.local.name,
                exported: specifier.exported.name,
                source: node.source.value,
              });
            }
          });
        } else {
          node.specifiers.forEach((specifier: any) => {
            if (specifier.type === 'ExportSpecifier') {
              exports.push({
                type: 'ExportSpecifier',
                name: specifier.local.name,
                exported: specifier.exported.name,
              });
            }
          });
        }
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      // 默认导出
      if (node.declaration.type === 'FunctionDeclaration') {
        exports.push({
          type: 'FunctionDeclaration',
          name: node.declaration.id
            ? node.declaration.id.name
            : 'anonymous function',
        });
      } else if (node.declaration.type === 'ClassDeclaration') {
        exports.push({
          type: 'ClassDeclaration',
          name: node.declaration.id
            ? node.declaration.id.name
            : 'anonymous class',
        });
      } else {
        exports.push({
          type: 'ExportDefaultDeclaration',
          name: node.declaration.name,
        });
      }
    } else if (node.type === 'ExportAllDeclaration') {
      // 重新导出（*导出）
      exports.push({
        type: 'ExportAllDeclaration',
        source: node.source.value,
        exported: node.exported?.name,
      });
    }
  }

  // 遍历 AST
  function traverseNode(node: any) {
    extractExports(node);
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        traverseNode(node[key]);
      }
    }
  }

  // 开始遍历 AST
  traverseNode(ast);

  return exports;
};

const getImportVariableFromContent = (codeContent: string) => {
  const ast = acorn.parse(codeContent, {
    sourceType: 'module',
    ecmaVersion: 'latest',
  });

  // 存储导入的变量
  const imports: any = [];

  // 遍历 AST 并提取 import 变量
  function extractImports(node: any) {
    if (node.type === 'ImportDeclaration') {
      node.specifiers.forEach((specifier: any) => {
        if (specifier.type === 'ImportSpecifier') {
          // 具名导入: import { a as b } from 'module';
          imports.push({
            type: 'NamedImport',
            imported: specifier.imported.name,
            local: specifier.local.name,
            source: node.source.value,
          });
        } else if (specifier.type === 'ImportDefaultSpecifier') {
          // 默认导入: import defaultExport from 'module';
          imports.push({
            type: 'DefaultImport',
            local: specifier.local.name,
            source: node.source.value,
          });
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          // 整体导入: import * as allExports from 'module';
          imports.push({
            type: 'NamespaceImport',
            local: specifier.local.name,
            source: node.source.value,
          });
        }
      });
    }
  }

  // 遍历 AST
  function traverseNode(node: any) {
    extractImports(node);
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        traverseNode(node[key]);
      }
    }
  }

  // 开始解析
  traverseNode(ast);

  // 输出所有解析出的 import 变量
  return imports;
};

export const tsxTransJsx = (codeContent: string) => {
  const result = ts.transpileModule(codeContent, {
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve, // 保留 JSX 语法
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
    },
  });

  return result.outputText;
};

export const handleGetFileContent = async (
  fileName: string,
  componentInfo: any,
) => {
  if (componentInfo.fileContentsMap[fileName]) {
    return componentInfo.fileContentsMap[fileName];
  } else {
    const fileContent = (
      await getFileContent({ id: componentInfo.id, fileName })
    ).data.fileContent;
    return fileContent;
  }
};

const generateModuleValue = async (
  fileName: string,
  moduleContent: string,
  componentInfo: any,
) => {
  (window as any).modulesMap[fileName] = {};
  const declarations = getDeclarationFromContent(moduleContent);
  const exports = getExportVariableFromContent(moduleContent);
  moduleContent = clearExportKeyWords(moduleContent);
  const outerExports = exports.filter((item) => item.source);
  for (let i = 0; i < outerExports.length; i++) {
    const outerExportContent = await handleGetFileContent(
      outerExports[i].source,
      componentInfo,
    );
    await generateModuleValue(
      outerExports[i].source,
      tsxTransJsx(outerExportContent),
      componentInfo,
    );
  }
  const functionString = `
(function(){
    ${exports
      .filter((item) => item.source)
      .map((item) => {
        // 有具体导出名字
        if (item.name) {
          return `window.modulesMap['${fileName}']['${item.exported ? item.exported : item.name}'] = window.modulesMap['${item.source}']['${item.name}'];\n`;
        } else {
          // * 的情况
          if (item.exported) {
            return `window.modulesMap['${fileName}']['${item.exported}'] = window.modulesMap['${item.source}'];\n`;
          } else {
            return `Object.assign(window.modulesMap['${fileName}'], window.modulesMap['${item.source}']);\n`;
          }
        }
      })
      .join('')}
    ${moduleContent}
    ${exports
      .filter((item) => !item.source)
      .map((item) => {
        return `window.modulesMap['${fileName}']['${item.exported ? item.exported : item.name}'] = ${item.name};\n`;
      })
      .join('')}
})()
  `;
  eval(functionString);
};

export const parseImportContent = async (
  importStateMent: string,
  componentInfo: any,
) => {
  const imports = getImportVariableFromContent(importStateMent);
  for (let i = 0; i < imports.length; i++) {
    const importContent = await handleGetFileContent(
      imports[i].source,
      componentInfo,
    );
    await generateModuleValue(
      imports[i].source,
      tsxTransJsx(importContent),
      componentInfo,
    );
  }

  return `
    ${imports
      .map((item: any) => {
        return `const ${item.local} = window.modulesMap['${item.source}']['${item.imported ? item.imported : item.local}'];\n`;
      })
      .join('')}
  `;
};
