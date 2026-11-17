import shot1 from "@/assets/shot-1.jpg";
import shot2 from "@/assets/shot-2.jpg";
import shot3 from "@/assets/shot-3.jpg";
import type { GradeItem, StudentRecord } from "@/lib/grading";

const items = (scores: [number, number, number, number]): GradeItem[] => {
  const base = [
    { id: "goal", label: "实验目的与原理", max: 10 },
    { id: "code", label: "核心代码实现", max: 40 },
    { id: "result", label: "运行结果截图", max: 30 },
    { id: "summary", label: "实验总结", max: 20 },
  ];
  return base.map((b, i) => {
    const score = scores[i] ?? 0;
    return {
      ...b,
      score,
      mark: score >= b.max ? "check" : score <= 0 ? "cross" : "half",
    } as GradeItem;
  });
};

const excerpts = [
  {
    question: "一、实验目的",
    answer:
      "掌握单链表的存储结构，熟练实现链表的创建、插入、删除、查找与逆置等基本操作，并分析各操作的时间复杂度。",
  },
  {
    question: "二、核心算法（插入操作）",
    answer:
      "新建结点 newNode，令 newNode->next = *head，再让 *head 指向 newNode。该方法为头插法，时间复杂度 O(1)。若需按位置插入，先遍历到第 i-1 个结点再修改指针。",
  },
  {
    question: "三、删除操作",
    answer:
      "使用 prev 与 temp 两个指针同步遍历，找到值为 value 的结点后，令 prev->next = temp->next 并 free(temp)。若删除的是头结点则直接修改 *head。",
  },
  {
    question: "四、实验总结",
    answer:
      "本次实验让我理解了指针操作的细节，一开始删除头结点时出现了段错误，后来通过判断 prev 是否为空解决了问题。",
  },
];

const screenshots = [
  { src: shot1, caption: "图1 创建、插入与查找" },
  { src: shot2, caption: "图2 删除与逆置结果" },
  { src: shot3, caption: "图3 源代码 linked_list.c" },
];

export const STUDENTS: StudentRecord[] = [
  {
    id: "s1",
    name: "陈思远",
    studentNo: "2023012401",
    className: "计科2301班",
    experimentNo: 3,
    experimentTitle: "单链表的基本操作",
    excerpts,
    screenshots,
    items: items([10, 36, 30, 15]),
    comment:
      "链表插入、删除逻辑清晰，头结点特殊情况处理得当；运行截图完整。总结部分略简单，建议补充时间复杂度分析。",
    written: false,
  },
  {
    id: "s2",
    name: "林晓雯",
    studentNo: "2023012402",
    className: "计科2301班",
    experimentNo: 3,
    experimentTitle: "单链表的基本操作",
    excerpts: excerpts.slice(0, 3),
    screenshots: screenshots.slice(0, 2),
    items: items([10, 40, 20, 18]),
    comment: "代码规范，注释充分。缺少源代码截图，运行结果仅展示部分功能。",
    written: false,
  },
  {
    id: "s3",
    name: "王子豪",
    studentNo: "2023012403",
    className: "计科2301班",
    experimentNo: 3,
    experimentTitle: "单链表的基本操作",
    excerpts,
    screenshots: [...screenshots.slice(0, 2)].reverse(),
    items: items([6, 28, 30, 0]),
    comment: "实验目的表述不完整；删除操作未释放内存。未提交实验总结。",
    written: false,
  },
];

export const COMMENT_PHRASES = [
  "思路清晰，代码规范。",
  "运行截图完整。",
  "请补充时间复杂度分析。",
  "注意释放动态分配的内存。",
  "总结过于简单，需结合实验过程。",
  "截图不清晰，请重新提交。",
];
