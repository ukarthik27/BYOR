
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


// rendering deep dom trees recursively is a render blocking process
// split work into smaller units
// use requestIdleCallback to implement (emulate) rendering in parts
// react doesnt use requestIdlecallback instead a scheduler package (https://github.com/facebook/react/tree/main/packages/scheduler)

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)

  return dom
}

let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = null

let wipFiber = null
let hookIndex = null

// for event listeners with "on"
const isEvent = key => key.startsWith("on")
const isProperty = key =>
  key !== "children" && !isEvent(key)
const isNew = (prev, next) => key =>
  prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)

//We compare the props from the old fiber to the props of the new fiber, remove the props that are gone, and set the props that are new or changed.
function updateDom(dom, prevProps, nextProps) {
  //Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(
      key =>
        !(key in nextProps) ||
        isNew(prevProps, nextProps)(key)
    )
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.removeEventListener(
        eventType,
        prevProps[name]
      )
    })

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ""
    })

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.addEventListener(
        eventType,
        nextProps[name]
      )
    })
}

//Once we finish all the work, we commit whole fiber tree to DOM
function commitWork(fiber) {
  if (!fiber) {
    return
  }

  // since fn comp are fibers without DOM nodes, we need search for fiber with DOM node
  let domParentFiber = fiber.parent
  while(!domParentFiber.dom){
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (
    fiber.effectTag === "PLACEMENT" &&
    fiber.dom != null
  ) {
    domParent.appendChild(fiber.dom)
  } else if (
    fiber.effectTag === "UPDATE" &&
    fiber.dom != null
  ) {
    updateDom(
      fiber.dom,
      fiber.alternate.props,
      fiber.props
    )
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber,domParent)
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber,domParent){
  if(fiber.dom){
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child,domParent)
  }
}

function commitRoot(){
  deletions.forEach(commitWork)
  // add nodes to dom
  commitWork(wipRoot.child)
  currentRoot = wipRoot //copy of what was committed. Used for Reconcilation
  wipRoot = null
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(
      nextUnitOfWork
    )
    /*
    timeRemaining() method on the IdleDeadline interface returns the estimated number of milliseconds remaining in the current idle period. 
    The callback can call this method at any time to determine how much time it can continue to work before it must return */
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber =
    wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (
    index < elements.length ||
    oldFiber != null
  ) {
    const element = elements[index]
    let newFiber = null

    const sameType =
      oldFiber &&
      element &&
      element.type === oldFiber.type

    if (sameType) {
      // update this node
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    if (element && !sameType) {
      // add this node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }
    if (oldFiber && !sameType) {
      // delete old fiber's node
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

function performUnitOfWork(fiber){
  // add dom node
  // add new node to DOM for each element. But browser could interrupt before we finish
  // we’ll keep track of the root of the fiber tree. - work in progress wipRoot
  
  // create new fibers
  // functional components are different
  // Fiber of fn comp doesnt have DOM node. Have to be called to return DOM.
  
  const isFuncComp = fiber.type instanceof Function
  if(isFuncComp){
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }
  

  // return next unit of work - child, sibiling, uncle
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
  
  
}
function updateFunctionComponent(fiber){
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber,children)
}

function updateHostComponent(fiber){
  if(!fiber.dom){
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber,fiber.props.children)
}

function useState(initial){
  const oldHook = 
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: []
  }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action instanceof Function ? action(hook.state) : action
  })

  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }
  
  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state,setState]

}
// ----------------------------------
const byor = {
  createElement,
  render,
  useState,
};

// comment like this one, when babel transpiles the JSX it will use the function we define.
/** @jsx byor.createElement */

const container = document.getElementById("root");

function InputComponent(){
  const [ipState, ipSetState] = byor.useState('there')
  return(
    <div>
      <p>A input component with local state</p>
      <label>Type and hit enter</label>
      <input style="margin:1rem 1rem 0 .5rem;" value={ipState} onChange={(e)=>ipSetState(e.target.value)} />
      <h2>Hello {ipState} !!</h2>
    </div>
  )
}
function Counter(){
  const [state, setState] = byor.useState(1)
  return (
    <div style="user-select: none; cursor:pointer;">
      Click below to increment count
      <h3 onClick={() => setState(state+1)}>
        Count: {state}
      </h3>
      <button onClick={()=>setState(0)}>Reset</button>
    </div>

  )
}
function App() {
  
  
  return (
    <div style="background: lightgreen; padding: 1rem;">
      <h1>Welcome !!</h1>
      <p>An attempt to understand how react works under the hood by breakdown to its basic functionalities and putting them back.</p>
      <hr />
      <h2>We have two functional components with a re-implementation of useState functionality for state management</h2>
      {Counter()}
      <hr />
      {InputComponent()}
      <hr />
      <p>Few things implemented to make this work</p>
      <ul>
        <li>Make babel transpile JSX using the custom function</li>
        <li>Render func : Create the DOM node using the element type</li>
        <li>Concurrent work: to prevent render blocking of a tree with large height</li>
        <li>Fiber: Unit of Work</li>
        <li>Render and commit phases - to prevent stuttering of UI on updates</li>
        <li>Reconcilation</li>
        <li>Functional components</li>
        <li>Native implementation of useState</li>
      </ul>
      <p>Few things react does better</p>
      <p>React's <a style="text-decoration: none;" href="https://github.com/facebook/react/tree/main/packages/scheduler">custom scheduler</a> to maintain split render into small chunks</p>
      <p>React skips entire subtrees when nothing is changed and uses old fiber tree in such cases skipping rendering part. There can be cases where there are multiple updates before a single commit. React gives priority to each update and decide which to commit.</p>
      <a style="text-decoration: none;" href="https://github.com/ukarthik27/byor">Github</a>      
    </div>
    
  )
}
const element = <App />
byor.render(element, container);




