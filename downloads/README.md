# 插件下载说明

此目录存放各插件的安装包。

## 发布时需要替换的文件

请将各插件的 `dist` 文件夹打包为 `.zip` 文件，替换以下占位文件：

```
downloads/
├── vcg.zip              # 视觉中国自动提交插件
├── xinpianchang.zip      # 新片场AIGC提交助手
├── vjshi.zip             # 光厂批量填写助手
├── dreamstime.zip        # Dreamstime Auto Submitter
├── adobestock.zip        # Adobe Stock关键词助手
├── qingying-image.zip    # 清影批量生图助手
└── qingying-video.zip    # 清影批量生视频助手
```

## 打包命令（Windows PowerShell）

在各插件目录下运行：

```powershell
# 视觉中国
Compress-Archive -Path "dist\*" -DestinationPath "..\..\downloads\vcg.zip" -Force

# 新片场
Compress-Archive -Path "dist\*" -DestinationPath "..\..\downloads\xinpianchang.zip" -Force

# 以此类推...
```

## 注意事项

1. 插件必须先 build 成 dist 文件夹再打包
2. 不要打包 node_modules 或源文件
3. ZIP 内应直接是插件文件（manifest.json 在根目录）
