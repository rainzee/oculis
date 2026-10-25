# Oculis 渲染测试

覆盖 GitHub Flavored Markdown 的常见语法, 用于肉眼比对渲染效果.

## 目录

- [文本](#文本)
- [列表](#列表)
- [代码](#代码)
- [表格](#表格)
- [提示块](#提示块)
- [引用](#引用)
- [链接与图片](#链接与图片)
- [脚注](#脚注)
- [HTML](#html)
- [重复标题](#重复标题)

## 文本

普通段落, 包含 **粗体**, *斜体*, ***粗斜体***, ~~删除线~~, `行内代码`, 以及 <kbd>Ctrl</kbd> + <kbd>C</kbd>.

中英混排 English mixed with 中文, 数字 12345, 符号 & < > " '.

这是一行很长的文本, 用于测试自动换行效果是否正常, 这是一行很长的文本, 用于测试自动换行效果是否正常, 这是一行很长的文本, 用于测试自动换行效果是否正常.

行尾两个空格  
产生硬换行, 反斜杠\
也可以.

---

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

## 列表

- 无序列表
- 第二项
  - 嵌套
    - 再嵌套
- 第三项

1. 有序列表
2. 第二项
   1. 嵌套有序
   2. 嵌套有序
3. 第三项

- [x] 已完成任务
- [ ] 未完成任务
  - [x] 嵌套任务

## 代码

```python
from dataclasses import dataclass


@dataclass
class Point:
    """二维坐标点"""

    x: float
    y: float

    def norm(self) -> float:
        return (self.x**2 + self.y**2) ** 0.5
```

```typescript
interface User {
  id: number
  name: string
}

const greet = (user: User): string => `Hello, ${user.name}!`
```

```json
{ "name": "oculis", "version": "0.1.0", "private": true }
```

```diff
- const old = 1
+ const next = 2
```

```
没有指定语言的代码块
    保留缩进
```

    缩进式代码块

超长代码行测试:

```js
const veryLongLine = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
```

## 表格

| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| apple | 苹果 | 1.00 |
| banana | 香蕉 | 12.50 |
| `cherry` | **樱桃** | 100.00 |

## 提示块

> [!NOTE]
> 一般提示信息.

> [!TIP]
> 有用的建议.

> [!IMPORTANT]
> 重要信息.

> [!WARNING]
> 需要注意的风险.

> [!CAUTION]
> 可能导致不良后果.

## 引用

> 一级引用
>
> > 嵌套引用
>
> 引用中的 `代码` 与 **强调**.

## 链接与图片

- 外部链接: [GitHub](https://github.com)
- 自动链接: https://www.electronjs.org
- 本地 Markdown 链接 (应在本窗口打开): [README](../README.md)
- 页内锚点: [回到顶部](#oculis-渲染测试)
- 邮件: <someone@example.com>

![GitHub Avatar](https://github.com/github.png?size=120)

## 脚注

这里有一个脚注[^1], 还有另一个[^note].

[^1]: 第一个脚注内容.
[^note]: 带名字的脚注.

## HTML

<details>
<summary>点击展开</summary>

折叠内容, 里面也可以写 **Markdown**.

</details>

<p align="center">居中的 HTML 段落</p>

<script>document.body.innerHTML = '脚本被执行了, CSP 失效'</script>

## 重复标题

## 重复标题

上面两个同名标题的锚点应分别为 `#重复标题` 和 `#重复标题-1`.
