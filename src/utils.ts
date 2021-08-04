type DebounceFn = (...args: any[]) => any;

export function debounce(func: DebounceFn, wait: number) {
  let timeout = 0;
  return function(this: any, ...args: any[]) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

export function parentHasClass(element: HTMLElement, className: string) {
  while (element) {
    if (element.classList && element.classList.contains(className)) return true;
    element = element.offsetParent as HTMLElement;
  }
  return false;
}

export function parentPosition(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}
