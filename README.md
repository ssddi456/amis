# amis

[![](https://vsmarketplacebadge.apphb.com/version-short/ssddi456.amis.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=ssddi456.amis)
[![](https://vsmarketplacebadge.apphb.com/installs-short/ssddi456.amis.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=ssddi456.amis)

## amis vscode plugin

此项目的主要目标是用于提升使用[amis](https://github.com/baidu/amis)进行开发及二次开发的各种项目，在vscode中的开发体验及开发速度

## 安装

如果你已经安装vscode，可以[点这里](vscode://extension/ssddi456.amis)安装，或者[前往应用市场](https://marketplace.visualstudio.com/items?itemName=ssddi456.amis)

## usage
在js或ts代码中为对象字面量添加注释，例如
```js
/** amis */
export default {
    type: "page",
    "body": [
        {
            "type": "form",
            "controls": [{
                type: "email",
                label: "邮件",
            }]
        }
    ]
}
```
该对象即被添加amis支持。

## 特性

* [x] 通过```/** amis */```来标记js/ts对象
* [x] 基于jsonschema为标记的对象添加自动完成及信息提示。
* [ ] 支持配置标记特征字符串
* [ ] 支持配置schema source(目前为静态引用的开源的amis项目中自动生成的schema)
* [ ] 支持基于schema/类型的模板填充
