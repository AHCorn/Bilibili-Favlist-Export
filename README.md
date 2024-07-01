<div align="center">

<a href="https://greasyfork.org/zh-CN/scripts/487532-%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E6%94%B6%E8%97%8F%E5%A4%B9%E5%AF%BC%E5%87%BA"> ![Bilibili-Favlist-Export](https://socialify.git.ci/AHCorn/Bilibili-Favlist-Export/image?description=1&descriptionEditable=%E5%AF%BC%E5%87%BA%E5%93%94%E5%93%A9%E5%93%94%E5%93%A9%E6%94%B6%E8%97%8F%E5%A4%B9%E4%B8%BA%20CSV%20%E6%88%96%20HTML%20%E6%96%87%E4%BB%B6%EF%BC%8C%E4%BB%A5%E4%BE%BF%E5%AF%BC%E5%85%A5%20Raindrop%20%E6%88%96%20Firefox&font=KoHo&forks=1&issues=1&language=1&name=1&owner=1&pulls=1&stargazers=1&theme=Auto) </a>

### **简体中文** | <a href="https://github.com/AHCorn/Bilibili-Favlist-Export/blob/main/README_EN.md"> English </a> 



</div>

## ⚠ 用前须知
本脚本的首选下载功能仅在 Vivaldi 浏览器的**暴力猴**插件中测试通过。

篡改猴或其余浏览器需新建标签页下载，为保险起见，在使用前，**请一定要为哔哩哔哩开启弹窗权限**❗

本脚本刚刚发布，个人虽已反复测试数十遍，但仍可能有未被发现的潜在问题，鉴于导出时间较长，请慎重选择。

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

