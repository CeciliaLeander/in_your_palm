/*
  src/99_export.js —— 全局导出
  
  将 InPalmEngine 挂到全局对象
  在浏览器环境下是 window,node 环境下是 global/this
*/

global.InPalmEngine = InPalmEngine;

// ========== v0.6.0-alpha.1.dev2 临时调试导出(阶段 2) ==========
// 目的:让浏览器 console 能直接验证 IIFE 内部的工具函数
// 阶段 2.5 收工时(动作迁移完成后)删除这一整块
InPalmEngine._debug = {
  // effects.js
  applyEffects: applyEffects,
  classifyEffect: classifyEffect,
  
  // session.js
  startSession: startSession,
  endSession: endSession,
  accumulatePalam: accumulatePalam,
  checkSessionTimeout: checkSessionTimeout,
  isSessionAction: isSessionAction
};