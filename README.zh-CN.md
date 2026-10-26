# 最近打开

适用于实现插件 API 3.7 的 Eidos Lite 宿主。[English](README.md)

需要 Eidos Lite 0.29.0 及以上版本，支持插件 API 3.7.0。
插件名称、命令、界面和包内说明会跟随宿主的英文或简体中文设置。

启用插件并授权文件打开元数据及自动启动后，每次打开 Space 都会自动记录文件路径、
打开次数和最近打开时间，关闭面板不影响记录。插件不读取文件内容，也不访问网络。
从侧边栏打开「最近打开」，或在 Cmd+K 执行「最近打开：打开面板」。
支持搜索路径，点击文件、次数或最近打开表头切换升降序，点击文件可重新打开；最多展示 200 个匹配文件。

有变化的数据每 10 秒保存一次，存储在本机插件私有空间，按 Space 分开统计。
每次后台运行使用独立存储键，多个窗口不会覆盖彼此的计数；其他窗口尚未保存的事件暂不可见。
历史不参与同步，也不导入 Lite 原有历史。文件重命名后视为另一个路径。

禁用插件可停止记录，更新插件需要重新授权。关闭 Space、禁用、更新或异常退出可能
丢失最近一个保存周期内的事件。保存失败会显示错误并自动重试。
总存储上限为 16 MiB，每次运行的对象上限为 4 MiB；目前不会自动清理旧记录。

## 开发维护

后台通过 `ctx.events.on("file.opened", listener)` 订阅宿主事件，接收 `id`、
`timestamp`（Unix 毫秒）及 Space 相对路径 `path`。需要声明
`background.fileHistory: true` 并获得宿主授权。后台停止时监听随之销毁，关闭面板不影响记录。

本仓库是插件的维护源，需要 Node >=22.12 和 pnpm。
锁文件固定公开的 SDK/tools 0.9.0，不需要私有工具归档或 Eidos 源码仓库。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run check --json
pnpm run pack --json
```

安装包和校验文件输出到 `dist/`。在 Lite「加载开发源码」中选择 `plugin.json`，
或安装生成的 `.eidos-plugin` 文件。检查通过不代表旧版 Lite 支持 API 3.7。

插件 ID 为 `eidos.recent-history`，使用独立的存储和启用状态，
不会导入旧版 `example.recent-history` 的历史。Eidos 主仓库只保留宿主集成测试夹具，
产品功能、界面及插件测试均在本目录维护。
