# Magic Cube

一个纯前端魔方小游戏，使用 Canvas 绘制 3D 魔方，不依赖网络、Three.js 或 WebGL。

## 运行方式

直接用浏览器打开 `index.html` 即可：

```text
D:\Desktop\codex\index.html
```

也可以用本地静态服务器运行：

```powershell
cd D:\Desktop\codex
python -m http.server 5173 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:5173/
```

## 操作

- 拖拽魔方区域：任意旋转视角
- 鼠标滚轮：缩放
- 双击魔方区域：恢复默认视角
- 点击 `U/D/L/R/F/B`：转动对应面
- 点击带 `'` 的按钮：反向转动
- 键盘 `U/D/L/R/F/B`：转动对应面
- `Shift + U/D/L/R/F/B`：反向转动
- `打乱`：随机打乱魔方
- `还原`：按历史步骤反向还原

## 文件结构

```text
.
├── index.html
├── styles.css
├── game.js
├── README.md
└── .gitignore
```

## 特性

- Canvas 3D 投影渲染
- 真实层旋转动画
- 任意视角观察
- 支持打乱、还原、计步和计时
- 无需安装依赖
