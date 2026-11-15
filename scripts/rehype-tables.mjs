// 把 Markdown 表格包进可聚焦容器，并给单元格加上列名，供 7.3 节「窄屏堆叠小卡」用。
function textOf(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  if (node.children) return node.children.map(textOf).join('');
  return '';
}

function visitTables(parent) {
  if (!parent || !parent.children) return;
  for (let i = 0; i < parent.children.length; i++) {
    const node = parent.children[i];
    if (node?.type === 'element' && node.tagName === 'table') {
      const labels = [];
      const thead = node.children?.find((c) => c.tagName === 'thead');
      const headerRow = thead?.children?.find((c) => c.tagName === 'tr');
      if (headerRow?.children) {
        for (const cell of headerRow.children) {
          if (cell.tagName === 'th' || cell.tagName === 'td') labels.push(textOf(cell).trim());
        }
      }
      const walkRows = (n) => {
        if (!n) return;
        if (n.tagName === 'td') {
          const idx = n._colIndex;
          if (typeof idx === 'number' && labels[idx]) {
            n.properties ??= {};
            n.properties['data-label'] = labels[idx];
          }
        }
        if (n.tagName === 'tr' && n.children) {
          let col = 0;
          for (const cell of n.children) {
            if (cell.tagName === 'th' || cell.tagName === 'td') {
              cell._colIndex = col++;
            }
          }
        }
        if (n.children) n.children.forEach(walkRows);
      };
      walkRows(node);

      let hasCaption = node.children?.some((c) => c.tagName === 'caption');
      if (!hasCaption) {
        node.children = [
          {
            type: 'element',
            tagName: 'caption',
            properties: { className: ['visually-hidden'] },
            children: [{ type: 'text', value: '数据表' }],
          },
          ...(node.children ?? []),
        ];
      }
      const caption = node.children.find((c) => c.tagName === 'caption');
      caption.properties ??= {};
      if (!caption.properties.id) caption.properties.id = 'table-caption';

      parent.children[i] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['table-wrap'],
          role: 'region',
          tabIndex: 0,
          ariaLabelledby: caption.properties.id,
        },
        children: [node],
      };
    } else {
      visitTables(node);
    }
  }
}

export default function rehypeTables() {
  return (tree) => {
    let n = 0;
    function retag(node) {
      if (node?.type === 'element' && node.tagName === 'div' && node.properties?.className?.includes?.('table-wrap')) {
        const cap = node.children?.[0]?.children?.find((c) => c.tagName === 'caption');
        if (cap) {
          cap.properties ??= {};
          cap.properties.id = `table-caption-${++n}`;
          node.properties.ariaLabelledby = cap.properties.id;
        }
      }
      node?.children?.forEach(retag);
    }
    visitTables(tree);
    retag(tree);
  };
}
