
// create element function
// JSX to react createElement function which returns a object 
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object" ? child : createTextElement(child)
      )
    }
  };
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT", //  The nodeValue property of the Node interface returns or sets the value of the current node.
    props: {
      nodeValue: text,
      children: []
    }
  };
}
// replace React.render(element,container)
// create the DOM node using the element type, and then append the new node to the container

function render(element, container) {
  const dom =
    element.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type);
  const isProperty = key => key !== "children";
  console.log(element)
  Object.keys(element.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = element.props[name];
    });
  element.props.children.forEach(child => render(child, dom));
  container.appendChild(dom);
}

const byor = {
  createElement,
  render
};

// comment like this one, when babel transpiles the JSX it will use the function we define.
/** @jsx byor.createElement */

const element = (
  <div style="background: lightgreen">
    <h1>Hello World</h1>
    <h2 style="text-align:right">from byor</h2>
  </div>
);
const container = document.getElementById("root");
byor.render(element, container);
