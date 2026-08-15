/* 修正 audit-planner2 地图选择器 → #mapBox */
const fs = require('fs');
let s = fs.readFileSync('audit-planner2.js', 'utf8');
s = s.replace("map: !!document.querySelector('#resultMap .leaflet-container, #mapEl .leaflet-container')", "map: !!document.querySelector('#mapBox .leaflet-container')");
fs.writeFileSync('audit-planner2.js', s, 'utf8');
console.log('selector fixed');
