/** Build documentation with textContent so catalog strings never become markup. */
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function textList(items) {
  const list = element('ul');
  for (const item of items) list.append(element('li', item));
  return list;
}
