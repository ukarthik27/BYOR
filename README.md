# Build your own react

An attempt to understand how react works under the hood by breakdown to its basic functionalities and putting them back.

#### Codesandbox: https://fexy87.csb.app/
---
Main file in `byor>src>index.js`

- createElement func
- Render func
- Concurrent mode ( requestIdleCallback )
- Split up work ( Fibers in react )
- Render and commit phase
- Reconciliation (virtual dom & diff)
- Support functional components
- Emulate `useState` Hooks
----
### createElement func
Make babel transpile JSX using the custom function

`createElement` func returns an object with `type`,`props` which has `children`  containing nested child
````
<h1 title="foo">Hello</h1>
```` 
becomes
```
{
	type: "h1",
	props: {
		title: "foo",
		children: "Hello"
	}
}
```
----
### Render func
Create the DOM node using the element type, and then append the new node to the container
split up work

----
### Concurrent mode
Rendering deep DOM trees recursively is a render blocking process. Split rendering into smaller units of work. Can use ` requestIdleCallback` to implement (emulate) rendering in parts.
React doesn't use requestIdlecallback instead a scheduler package.(https://github.com/facebook/react/tree/main/packages/scheduler)

```
function workLoop(){
	while(nextUnitOfWork){
		nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
	}
}
```

```
requestIdleCallback(workLoop)
```
----
### Fiber
Unit of work. One fiber created for each DOM node. DOM tree will be converted to a fiber tree.
rootfiber will be the initial `nextUnitofWork`

For each fiber
- add the element to DOM
- create fibers for element's children
- select next unit of work
	
Each fiber is linked to child elements and sibling elements. While selecting next unit of work for a fiber, it follows the precedence `child > sibling > sibling of parent`. If fiber doesnt have child / sibling. its work is complete and next unit of work is parent's sibling.
`performUnitOfWork` func.

----
### Render and commit phases
Browser could interrupt before we finish rendering a deep nested whole tree. This might causes stuttering and even incomplete UI. Hence we keep track of current fiber which is processed, and create DOM (commit whole fiber tree) only when we there is not a unit of work. `commitWork` func.

----
### Reconciliation 
Updation or deletion of DOM nodes, results in construction of whole fiber tree construction again. Computationally expensive.
Compare elements on current render with last fiber tree which was commited.
Previous saved fiber tree is similar to virtual dom concept.

Each fiber will have link to old committed fiber. And compare them
- Different types, keep DOM node and just update props
- Types are different and a new element to add, create a new DOM node
- Types are different,  connection to an oldfiber, remove the old node

React uses keys to detect when children change places in element array. We skip that.

We keep track of oldfibers to delete and do it once in commit phase.
`updateDom` func

----
### Functional components
Fiber from func component has no DOM node.
Hence, Children from functional components obtained by calling them instead of accessing them via props.

----
### useState
Emulate state management by implementing one of the fundamental hooks `useState`. 
We maintain a hooks array and current hook index. To keep it simple, our setstate accepts functions and values. In code it is actions. Old state will be passed to this function, which return the new state. 

----
Few things react does better. React skips entire subtrees when nothing is changed and uses old fiber tree in such cases skipping rendering part.There can be cases where there are multiple updates before a single commit. React gives priority to each update and decide which to commit.

[Full Credits to Rodrigo pombo](https://pomb.us/build-your-own-react/)
