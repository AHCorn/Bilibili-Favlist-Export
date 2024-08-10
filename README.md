<div align="center">

#  <img src="https://www.bilibili.com/favicon.ico" width="30" height="30" style="vertical-align: text-bottom;">  <a href="https://greasyfork.org/zh-CN/scripts/487532-%E5%93%94%E5%93%A9%E5%93%A9%E5%93%A9%E5%93%A9%E6%94%B6%E8%97%8F%E5%A4%B9%E5%AF%BC%E5%87%BA" style="text-decoration: none;"> Bilibili-Favlist-Export </a>

#### **简体中文** | <a href="https://github.com/AHCorn/Bilibili-Favlist-Export/blob/main/README_EN.md"> English </a>

导出哔哩哔哩收藏夹为 CSV 或 HTML 文件，以便导入 Raindrop 或 Firefox

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![GitHub stars](https://img.shields.io/github/stars/AHCorn/Bilibili-Favlist-Export?style=for-the-badge)
![GitHub issues](https://img.shields.io/github/issues/AHCorn/Bilibili-Favlist-Export?style=for-the-badge)
![GitHub pull requests](https://img.shields.io/github/issues-pr/AHCorn/Bilibili-Favlist-Export?style=for-the-badge)
![GitHub forks](https://img.shields.io/github/forks/AHCorn/Bilibili-Favlist-Export?style=for-the-badge)

</div>

<br>

## ⚠ 用前须知

本脚本所使用的 CSV 格式为 Raindrop 所要求的格式，HTML 为 Firefox 所使用的备份格式，对于其它浏览器兼容性未知。

导出速度固定在代码中的 ``` const DELAY = 2000; ``` 部分，如果您的加载速度足够，可以降低延时。

如果您出现了收藏夹错位的情况，则是网络条件和导出延时不匹配。

若您希望与  收藏夹Fix 一起使用，请至少增加至 4000 延时以等待脚本加载。


<br>

## ⭐ 特性
1. 拥有独立的导出面板。
2. 自动遍历所有收藏夹视频。
3. 支持用户自选导出格式。
4. 支持用户自选导出内容（CSV）。
5. 支持用户自定义父级书签文件夹（HTML）。
6. 实时查看导出进度。
   
<br>


## 💻 使用
该版本是 [Bilibili-To-Raindrop](https://github.com/AHCorn/Bilibili-To-Raindrop) 的衍生版本，操作更为便捷，支持格式和自定义程度更广。

如果您仅需要导出至Raindrop格式所需的CSV文件，追求兼容性和速度，可以不安装油猴脚本直接使用控制台脚本。

在哔哩哔哩收藏夹页面按下 F12，或右键网页选中检查，并将以下代码粘贴至浏览器控制台（console）中
```js
var delay = 2000; //等待时间
var gen = listGen();
var csvContent = "\uFEFF";
csvContent += "folder,title,url\n";

function getCSVFileName() {
    var userName = $("#h-name").text();
    return userName + "的收藏夹.csv";
}

function getFolderName() {
    return $("#fav-createdList-container .fav-item.cur a.text").text().trim();
}

function escapeCSV(field) {
    return '"' + String(field).replace(/"/g, '""') + '"';
}

function getVideosFromPage() {
    var results = [];
    var folderName = getFolderName().replace(/\//g, '\\'); // 替换 / 为 \ 避免 Raindrop 识别出错
    $(".fav-video-list > li > a.title").each(function() {
        var title = $(this).text().replace(/,/g, '');
        if (title !== "已失效视频") {
            var url = 'https:' + $(this).attr("href");
            results.push(escapeCSV(folderName) + ',' + escapeCSV(title) + ',' + escapeCSV(url));
        }
    });
    return results.join('\n');
}

function processVideos() {
    csvContent += getVideosFromPage() + '\n'; // 自动换行
    if ($(".be-pager-next:visible").length == 0) {
        setTimeout(changeList, delay);
    } else {
        $(".be-pager-next").click();
        setTimeout(processVideos, delay);
    }
}

function* listGen() {
    for (var list of $("#fav-createdList-container .fav-item a").get()) {
        yield list;
    }
}

function changeList() {
    var list = gen.next().value;
    if (list) {
        list.click();
        setTimeout(processVideos, delay);
    } else {
        downloadCSV();
    }
}

function downloadCSV() {
    var fileName = getCSVFileName();
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);

    var win = window.open();
    if (win) {
        win.document.open();
        win.document.write('<html><body>');
        win.document.write('<a href="' + url + '" download="' + fileName + '">点击下载</a>');
        win.document.write('<script>document.querySelector("a").click();</script>');
        win.document.write('</body></html>');
        win.document.close();
    } else {
        alert('下载窗口被浏览器阻止，请先在设置里允许网页弹窗后重试。');
    }
}

changeList();

```


## ❤️ 感谢
原始获取代码来自于 [快速导出B站收藏单节目列表 - 鱼肉真好吃](https://www.cnblogs.com/toumingbai/p/11399238.html)

遍历所有收藏夹部分的代码来自于 [BiliBackup](https://github.com/sweatran/BiliBackup?tab=readme-ov-file)

