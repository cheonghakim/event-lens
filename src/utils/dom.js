export function el(tag, className, attrs = {}) {
  const node = document.createElement(tag)
  if (className) node.className = className
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'textContent') node.textContent = v
    else if (k === 'innerHTML') node.innerHTML = v
    else node.setAttribute(k, v)
  }
  return node
}

export function clearEl(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export function on(node, event, handler, options) {
  node.addEventListener(event, handler, options)
  return () => node.removeEventListener(event, handler, options)
}

export function delegate(container, selector, event, handler) {
  const listener = (e) => {
    const target = e.target.closest(selector)
    if (target && container.contains(target)) handler(e, target)
  }
  container.addEventListener(event, listener)
  return () => container.removeEventListener(event, listener)
}

export function setVisible(node, visible) {
  node.style.display = visible ? '' : 'none'
}

export function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
