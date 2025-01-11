<div align="center">

# 🚛 Bilibili-Favlist-Export

### <a href="https://github.com/AHCorn/Bilibili-Favlist-Export/"> Simplified Chinese </a>  / English 

Export Bilibili favorites to CSV or HTML files for importing into Raindrop or Firefox.

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E) 

</div>

## ⚠ Warm Tips
The script's preferred download function has only been tested with the **Tampermonkey** extension in the Vivaldi browser.

For Greasemonkey or other browsers, downloads require opening a new tab. For safety, **please be sure to enable pop-up permissions for Bilibili**❗

This script has just been released. Although I have tested it dozens of times personally, there may still be potential issues that have not been discovered. Considering the lengthy export time, please choose cautiously.

The export speed is fixed in the code at ``` const DELAY = 2000; ```. If your loading speed is sufficient, you can reduce the delay.

If your favorites are misplaced, it is due to the mismatch between network conditions and the export delay.

If you wish to use it with the Favorites Fix, please increase the delay to at least 4000 to wait for the script to load.



<br>

## ⭐ Features
1. Has an independent export panel.
2. Automatically traverses all favorite videos.
3. Supports user-selected export formats.
4. Supports user-selected export content (CSV).
5. Supports user-defined parent bookmark folder (HTML).
6. Real-time export progress view.
   
<br>


## 💻 Usage
This version is a derivative of [Bilibili-To-Raindrop](https://github.com/AHCorn/Bilibili-To-Raindrop), which is more convenient to use and supports a wider range of formats and customization.

If you only need to export to the CSV file required by the Raindrop format, seeking compatibility and speed, you can use the console script directly without installing a Tampermonkey script.

Press F12 on the Bilibili favorites page, or right-click to inspect, and paste the following code into the browser console (console)
```js
var delay = 2000; //等待时间
var gen = listGen();
var csvContent = "\uFEFF";
csvContent += "folder,title,url,created\n";

function getCSVFileName() {
    let userName = document.querySelector(".nickname").innerHTML;
    return userName + "的收藏夹.csv";
}

function getFolderName() {
    return document.querySelector(".favlist-info-detail__title .vui_ellipsis").innerHTML;
}

function escapeCSV(field) {
    return '"' + String(field).replace(/"/g, '""') + '"';
}

function getVideosFromPage() {
    var results = [];
    var folderName = getFolderName().replace(/\//g, '\\');
    document.querySelectorAll(".fav-list-main .items__item").forEach(function (item) {
        var titleElement = item.querySelector(".bili-video-card__title");
        var title = titleElement.title.replace(/,/g, '');
        if (title !== "已失效视频") {
            let url = item.querySelector(".bili-video-card__title a").href
            let subtitleLink = item.querySelector(".bili-video-card__subtitle a")
            let timeText = ''
            if (subtitleLink) // 一般视频
                timeText = subtitleLink.querySelector("div:last-child>span").title
            else { // 链接不可点击
                let subtitle = item.querySelector(".bili-video-card__subtitle>span").title
                if (subtitle.includes("收藏于")) {// 特殊视频，如电影
                    timeText = subtitle;
                    title = timeText.trim().split("·")[0].trim();
                }
                else { // 某些订阅合集中的视频
                    timeText = subtitle;
                    title = titleElement.title.replace(/,/g, '');
                }
            }
            var created = timeText.trim().split("·").slice(-1)[0].trim().slice(3);
            results.push(escapeCSV(folderName) + ',' + escapeCSV(title) + ',' + escapeCSV(url) + ',' + escapeCSV(created));
        }
    });
    return results.join('\n');
}

function processVideos() {
    csvContent += getVideosFromPage() + '\n';
    currentPage++;
    let turnPage = document.querySelector(".vui_pagenation--btn-side:last-child");
    if (currentPage < totalPage && turnPage) {
        turnPage.click();
        setTimeout(processVideos, delay);
    } else {
        setTimeout(changeList, delay);
    }
}

function* listGen() {
    const lists = document.querySelectorAll(".fav-collapse:nth-child(-n+2) .vui_collapse_item .fav-sidebar-item .vui_sidebar-item");
    for (let list of lists) {
        yield list;
    }
}

function changeList() {
    let list = gen.next().value;
    if (list) {
        list.click();
        setTimeout(() => {
            let PageCountDesc = document.querySelector(".vui_pagenation-go__count")
            if (PageCountDesc)
                totalPage = parseInt(PageCountDesc.innerHTML.match(/\d+/)[0]) || 1;
            currentPage = 0;
            processVideos();
        }, delay);
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

## ❤️ Thanks

The original fetching code comes from [快速导出B站收藏单节目列表 - 鱼肉真好吃](https://www.cnblogs.com/toumingbai/p/11399238.html). 

If you need to backup your entire Bilibili favorites folder in text format, you can also use this open-source project: [BiliBackup](https://github.com/sweatran/BiliBackup?tab=readme-ov-file)
