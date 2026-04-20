#!/usr/bin/env node
/*
  build.js —— 掌心的它引擎构建脚本
  
  用法：node build.js
  
  按顺序拼接 src/ 下的所有文件，生成单一的 engine.js
  - 先加载常量、状态
  - 然后数据表
  - 然后核心逻辑（依赖数据和状态）
  - 然后系统层（依赖核心逻辑）
  - 最后 API 层和导出
  
  所有内容包裹在 IIFE 中，防止污染全局命名空间
*/

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT = path.join(__dirname, 'engine', 'engine.js');

// 文件加载顺序（极其重要：依赖关系决定顺序）
const BUILD_ORDER = [
  // 第一层：常量与状态
  '00_constants.js',
  '01_state.js',
  
  // 第二层：数据表（只是数据定义，无依赖）
  'data/sources.js',
  'data/palam.js', 
  'data/juels.js', 
  'data/imprints.js', 
  'data/personas.js',
  'data/scenes.js',
  'data/items.js',
  'data/toys.js',
  'data/actions.js',
  'data/training.js',
  'data/dialogue.js',
  'data/risks.js',
  'data/custom_templates.js',
  
  // 第三层：核心逻辑（依赖数据和状态）
  // effects 和 milestones 相互引用，所以先定义函数 hoisting 会处理
  'core/effects.js',
  'core/milestones.js',
  'core/time.js',
  'core/conditions.js',
  'core/inventory.js',
  'core/context.js',
  'core/risks.js',
  
  // 第四层：系统（依赖核心逻辑）
  'systems/toys.js',
  'systems/dialogue.js',
  
  // 第五层：公开 API（依赖所有系统）
  '98_api.js',
  '99_export.js'
];

function readFile(relPath) {
  const fullPath = path.join(SRC_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`缺失文件: ${relPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function build() {
  console.log('=== 掌心的它 Engine 构建 ===');
  console.log('');
  
  const parts = [];
  let totalLines = 0;
  
  // 文件顶部的横幅
  parts.push(`/*
  掌心的它 · In Your Palm —— 酒馆角色卡引擎
  
  !!! 此文件是自动生成的，请勿直接编辑 !!!
  要修改引擎，请编辑 src/ 下的对应源文件，然后运行 node build.js
  
  源文件清单（按加载顺序）：
${BUILD_ORDER.map(f => '    - ' + f).join('\n')}
  
  构建时间: ${new Date().toISOString()}
*/

(function(global) {
'use strict';

`);
  
  // 按顺序加载每个文件
  for (const relPath of BUILD_ORDER) {
    const content = readFile(relPath);
    const lines = content.split('\n').length;
    totalLines += lines;
    
    parts.push(`\n// ============================================================\n`);
    parts.push(`// [${relPath}]\n`);
    parts.push(`// ============================================================\n\n`);
    parts.push(content);
    parts.push('\n');
    
    console.log(`  ✓ ${relPath}  (${lines} lines)`);
  }
  
  // IIFE 结尾
  parts.push(`\n})(typeof window !== 'undefined' ? window : this);\n`);
  
  const output = parts.join('');
  fs.writeFileSync(OUTPUT, output);
  
  const finalLines = output.split('\n').length;
  
  console.log('');
  console.log(`源码总行数: ${totalLines}`);
  console.log(`输出文件: ${OUTPUT}`);
  console.log(`输出行数: ${finalLines}`);
  console.log('');
  console.log('✓ 构建完成');
}

try {
  build();
} catch (err) {
  console.error('构建失败:', err.message);
  process.exit(1);
}
