/*
  src/99_export.js —— 全局导出
  
  将 InPalmEngine 挂到全局对象
  在浏览器环境下是 window，node 环境下是 global/this
*/

global.InPalmEngine = InPalmEngine;
