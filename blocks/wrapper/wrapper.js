export default function decorate(block) {
  block.querySelectorAll('p').forEach((p) => {
    const wrapper = document.createElement(p.querySelector('strong') ? 'aside' : 'div');
    p.replaceWith(wrapper);
    wrapper.append(p);
  });
}
