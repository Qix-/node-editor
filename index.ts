// TODO turn into attributes
const ZOOM_RATE = 0.085;
const MIN_ZOOM = 0.2; // CANNOT BE ZERO!
const MAX_ZOOM = 1;
const GRID_RESOLUTION = 32;
const GRID_DOT_RADIUS = 1.5;
const PATH_WIDTH = 5;
const PATH_TENSION = 0.5;
const MIN_PATH_TENSION = 50.0;
const MAX_INVERTED_PATH_TENSION = 300;
const DEFAULT_PORT_RADIUS = 7;
const DEFAULT_PORT_COLOR = '#555';

const HTML = document.createElement.bind(document);

function SVG(tag: 'param'): SVGElement;
function SVG<K extends keyof SVGElementTagNameMap>(
	tag: K
): SVGElementTagNameMap[K];
function SVG(tag: any) {
	return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function roundTo(v: number, to: number): number {
	return Math.ceil(v / to) * to;
}

function attr<T extends Element>(
	elem: T,
	map: {
		[key: string]:
			| string
			| number
			| null
			| { [key: string]: string | number | null };
	}
): T {
	for (const k of Object.keys(map)) {
		const v = map[k];
		if (v === null) {
			elem.removeAttribute(k);
		} else if (typeof v === 'object') {
			for (const nsk of Object.keys(v)) {
				const nsv = v[nsk];
				if (nsv === null) {
					elem.removeAttributeNS(k, nsk);
				} else {
					elem.setAttributeNS(k, nsk, nsv.toString());
				}
			}
		} else {
			elem.setAttribute(k, v.toString());
		}
	}
	return elem;
}

function setLinkCurve(
	elem: SVGPathElement,
	x1: number,
	y1: number,
	x2: number,
	y2: number
) {
	x1 = roundTo(x1, 0.1);
	y1 = roundTo(y1, 0.1);
	x2 = roundTo(x2, 0.1);
	y2 = roundTo(y2, 0.1);

	const hDist = x2 - x1;
	const t = roundTo(
		Math.max(
			MIN_PATH_TENSION,
			Math.abs(Math.max(-MAX_INVERTED_PATH_TENSION, hDist * PATH_TENSION))
		),
		0.1
	);

	elem.setAttribute(
		'd',
		`M${x1} ${y1}C${x1 + t} ${y1} ${x2 - t} ${y2} ${x2} ${y2}`
	);
}

interface Connectable {
	connectedCallback: () => void;
	disconnectedCallback: () => void;
}

function upgradeAll<T extends HTMLElement, U extends HTMLElement & Connectable>(
	self: T,
	tagName: string,
	childType: new () => U
) {
	const children = self.getElementsByTagName(tagName);
	for (let i = 0, len = children.length; i < len; i++) {
		const child = children.item(i);
		if (child instanceof childType) {
			child.disconnectedCallback();
			child.connectedCallback();
		}
	}
}

function createDebouncedResizeObserver(
	cb: (width: number, height: number) => void
): ResizeObserver {
	let lastWidth: number = Infinity;
	let lastHeight: number = Infinity;
	let ignoreResize: number | null = null;

	const resizeObserver = new ResizeObserver(([{ contentRect, target }]) => {
		if (ignoreResize !== null) {
			ignoreResize = null;
			return;
		}

		const newWidth = contentRect.width;
		const newHeight = contentRect.height;

		if (newWidth === lastWidth && newHeight === lastHeight) return;

		lastWidth = newWidth;
		lastHeight = newHeight;

		try {
			resizeObserver.unobserve(target);
			cb(newWidth, newHeight);
		} finally {
			const token = Math.random();
			ignoreResize = token;
			setTimeout(() => {
				if (ignoreResize === token) ignoreResize = null;
			}, 0);
			resizeObserver.observe(target);
		}
	});

	return resizeObserver;
}

declare class AttrObservable {
	static observedAttributes: string[];
}

// Upgrades properties on custom elements that might have
// been primitively set prior to the prototype attachment.
function upgradeProperties<T extends AttrObservable>(this: T) {
	const props = <(keyof T)[] | undefined>(
		(<typeof AttrObservable>this.constructor).observedAttributes
	);

	if (props) {
		for (const prop of props) {
			if (this.hasOwnProperty(prop)) {
				const value = this[prop];
				delete this[prop];
				this[prop] = value;
			}
		}
	}
}

function findAncestorOfType<T extends Node>(
	from: Node,
	type: new () => T
): T | undefined {
	let cur: Node | null = from;

	do {
		if (cur instanceof type) {
			return cur;
		}

		cur = cur.parentNode;
	} while (cur && cur !== document.body);

	return;
}

// Private members
const internal = Symbol();
const updateTransform = Symbol();
const refreshPosition = Symbol();
const refreshColor = Symbol();
const refreshConnection = Symbol();
const notifyConnection = Symbol();

class NodeMapViewportStartEvent extends Event {
	constructor() {
		super('viewportstart', { bubbles: true });
	}
}

class NodeMapViewportStopEvent extends Event {
	constructor() {
		super('viewportstop', { bubbles: true });
	}
}

class NodeMapViewportEvent extends Event {
	offsetX: number;
	offsetY: number;
	zoom: number;

	constructor(offsetX: number, offsetY: number, zoom: number) {
		super('viewport', { bubbles: true });
		this.offsetX = offsetX;
		this.offsetY = offsetY;
		this.zoom = zoom;
	}
}

class NodeEditorTransformEvent extends Event {
	x: number;
	y: number;
	width: number;
	height: number;
	didResize: boolean;
	didMove: boolean;

	constructor(opts: {
		x: number;
		y: number;
		width: number;
		height: number;
		didResize: boolean;
		didMove: boolean;
	}) {
		super('transform', { bubbles: true });
		this.x = opts.x;
		this.y = opts.y;
		this.width = opts.width;
		this.height = opts.height;
		this.didResize = opts.didResize;
		this.didMove = opts.didMove;
	}
}

class NodePortPositionEvent extends Event {
	x: number;
	y: number;

	constructor(x: number, y: number) {
		super('position', { bubbles: true });
		this.x = x;
		this.y = y;
	}
}

class NodePortColorEvent extends Event {
	color: string;

	constructor(color: string) {
		super('color', { bubbles: true });
		this.color = color;
	}
}

class NodePortOnlineEvent extends Event {
	port: NodePortElement;

	constructor(port: NodePortElement) {
		super('online', { bubbles: true });
		this.port = port;
	}
}

class NodePortOfflineEvent extends Event {
	port: NodePortElement;

	constructor(port: NodePortElement) {
		super('offline', { bubbles: true });
		this.port = port;
	}
}

class NodeEditorAddEvent extends Event {
	editor: NodeEditorElement;

	constructor(editor: NodeEditorElement) {
		super('add', { bubbles: true });
		this.editor = editor;
	}
}

class NodeEditorRemoveEvent extends Event {
	editor: NodeEditorElement;

	constructor(editor: NodeEditorElement) {
		super('remove', { bubbles: true });
		this.editor = editor;
	}
}

class NodeNameEvent extends Event {
	name: string | null;
	oldName: string | null;

	constructor(name: string | null, oldName: string | null) {
		super('name', { bubbles: true });
		this.name = name;
		this.oldName = oldName;
	}
}

class NodeLinkEvent extends Event {
	link: NodeLinkElement;

	constructor(link: NodeLinkElement) {
		super('link', { bubbles: true });
		this.link = link;
	}
}

class NodeUnlinkEvent extends Event {
	link: NodeLinkElement;

	constructor(link: NodeLinkElement) {
		super('unlink', { bubbles: true });
		this.link = link;
	}
}

class NodeConnectEvent extends Event {
	link: NodeLinkElement;

	constructor(link: NodeLinkElement, bubbles: boolean) {
		super('connect', { bubbles });
		this.link = link;
	}
}

class NodeDisconnectEvent extends Event {
	link: NodeLinkElement;

	constructor(link: NodeLinkElement, bubbles: boolean) {
		super('disconnect', { bubbles });
		this.link = link;
	}
}

class NodePortElement extends HTMLElement {
	private [internal]: {
		root: HTMLSpanElement;
		portMarker: HTMLSpanElement;
		handleSlot: HTMLSlotElement;
		resizeObserver: ResizeObserver;
		editor?: NodeEditorElement;
		defaultPortMarker: HTMLSpanElement;
		editorResizeAbort?: AbortController;
		handlePosition: [number, number];
		connections: Set<NodeLinkElement>;
	};

	static get observedAttributes() {
		return ['name', 'color', 'out'];
	}

	constructor() {
		super();
		const shadow = this.attachShadow({
			mode: 'closed'
		});

		upgradeProperties.call(this);

		const root = HTML('span');

		const I = (this[internal] = {
			root,
			portMarker: HTML('span'),
			resizeObserver: createDebouncedResizeObserver(() =>
				this[refreshPosition]()
			),
			defaultPortMarker: HTML('span'),
			handleSlot: attr(HTML('slot'), {
				name: 'handle'
			}),
			handlePosition: [0, 0],
			connections: new Set()
		});

		Object.assign(I.portMarker.style, {
			position: 'absolute',
			userSelect: 'none',
			cursor: 'pointer'
		});

		I.portMarker.appendChild(I.handleSlot);

		shadow.appendChild(root);
		shadow.appendChild(I.portMarker);
		root.appendChild(HTML('slot'));

		Object.assign(I.defaultPortMarker.style, {
			display: 'inline-block',
			borderRadius: '50%',
			width: `${DEFAULT_PORT_RADIUS * 2}px`,
			height: `${DEFAULT_PORT_RADIUS * 2}px`,
			backgroundColor: 'var(--port-color)',
			border: 'solid 1px #1115'
		});

		I.handleSlot.addEventListener('slotchange', () => {
			if (I.handleSlot.assignedNodes().length === 0) {
				I.portMarker.appendChild(I.defaultPortMarker);
			} else {
				I.defaultPortMarker.remove();
			}
		});

		I.portMarker.appendChild(I.defaultPortMarker);

		this[refreshPosition]();
		this[refreshColor]();

		this.addEventListener('connect', e => {
			I.connections.add((<NodeConnectEvent>e).link);
			this.setAttribute('connections', I.connections.size.toString());
		});
		this.addEventListener('disconnect', e => {
			I.connections.delete((<NodeDisconnectEvent>e).link);
			const count = I.connections.size;
			if (count > 0) {
				this.setAttribute('connections', count.toString());
			} else {
				this.removeAttribute('connections');
			}
		});
	}

	get numConnections(): number {
		return this[internal].connections.size;
	}

	get connections(): NodeLinkElement[] {
		return [...this[internal].connections];
	}

	get name(): string | null {
		return this.getAttribute('name');
	}

	set name(v: string | null) {
		if (v === null) this.removeAttribute('name');
		else this.setAttribute('name', v);
	}

	get nodeEditor(): NodeEditorElement | null {
		return this[internal].editor ?? null;
	}

	get color(): string {
		return this.getAttribute('color') || DEFAULT_PORT_COLOR;
	}

	set color(v: string | null) {
		if (v === null) this.removeAttribute('color');
		else this.setAttribute('color', v);
	}

	get isOutputPort(): boolean {
		return this.hasAttribute('out');
	}

	set isOutputPort(v: boolean | null) {
		this.removeAttribute('out');
		if (v) {
			this.setAttribute('out', '');
		}
	}

	get handleX(): number {
		return this[internal].handlePosition[0];
	}

	get handleY(): number {
		return this[internal].handlePosition[1];
	}

	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null
	) {
		switch (name) {
			case 'out':
				this[refreshPosition]();
				break;
			case 'color':
				this[refreshColor]();
				break;
			case 'name': {
				if (oldValue !== newValue) {
					this.dispatchEvent(new NodeNameEvent(newValue, oldValue));
				}
				break;
			}
		}
	}

	private [refreshColor]() {
		const I = this[internal];
		I.portMarker.style.setProperty('--port-color', this.color);

		this.dispatchEvent(new NodePortColorEvent(this.color));
	}

	private [refreshPosition]() {
		const I = this[internal];

		if (!I.editor) return;

		const marker =
			I.handleSlot.assignedNodes().length > 0
				? I.portMarker
				: I.defaultPortMarker;

		const { y: editorY, x: editorX, width: editorWidth } = I.editor;

		const { height: portHeight } = I.root.getBoundingClientRect();
		const portY = I.root.offsetTop;

		const { width: markerWidth, height: markerHeight } =
			marker.getBoundingClientRect();

		let xPos = this.hasAttribute('out') ? editorWidth : 0;
		let yPos = portY - editorY + portHeight / 2;

		Object.assign(I.portMarker.style, {
			position: 'absolute',
			left: `${xPos - markerWidth / 2}px`,
			top: `${yPos - markerHeight / 2}px`
		});

		I.handlePosition = [xPos + editorX, yPos + editorY];
		this.dispatchEvent(new NodePortPositionEvent(xPos, yPos));
	}

	connectedCallback() {
		const I = this[internal];

		I.editor = findAncestorOfType(this, NodeEditorElement);

		I.resizeObserver.observe(this);
		I.resizeObserver.observe(I.portMarker);

		if (I.editor) {
			I.editorResizeAbort = new AbortController();
			I.editor.addEventListener(
				'transform',
				() => this[refreshPosition](),
				{ passive: true, signal: I.editorResizeAbort.signal }
			);
		}

		this.dispatchEvent(new NodePortOnlineEvent(this));

		this[refreshPosition]();
	}

	disconnectedCallback() {
		const I = this[internal];

		I.resizeObserver.unobserve(this);
		I.resizeObserver.unobserve(I.portMarker);

		if (I.editorResizeAbort) {
			I.editorResizeAbort.abort();
			delete I.editorResizeAbort;
		}

		const ev = new NodePortOfflineEvent(this);
		this.dispatchEvent(ev);
		if (ev.bubbles && !ev.cancelBubble) I.editor?.dispatchEvent(ev);

		delete I.editor;
	}
}

class NodeTitleElement extends HTMLElement {
	private [internal]: {
		editor?: NodeEditorElement;
	};

	constructor() {
		super();
		this[internal] = {};

		let dragId: number | null = null;
		let dragStart = [0, 0, 0, 0];

		const onDrag = (e: PointerEvent) => {
			const I = this[internal];
			const editor = I.editor;
			const zoom = I.editor?.nodeMap?.zoom ?? 1;

			if (editor) {
				editor.x = dragStart[0] + (e.clientX - dragStart[2]) / zoom;
				editor.y = dragStart[1] + (e.clientY - dragStart[3]) / zoom;
			}
		};

		this.addEventListener('pointerdown', e => {
			if (dragId !== null) return;
			if (e.button !== 0) return;

			const editor = this[internal].editor;
			if (!editor) return;

			const abortController = new AbortController();

			dragStart = [editor.x, editor.y, e.clientX, e.clientY];

			this.classList.add('dragging');
			this.setPointerCapture(e.pointerId);
			this.addEventListener('pointermove', onDrag, {
				signal: abortController.signal
			});
			dragId = e.pointerId;

			document.addEventListener(
				'pointerup',
				e => {
					if (e.pointerId !== dragId) return;
					this.classList.remove('dragging');
					this.releasePointerCapture(e.pointerId);
					dragId = null;
					abortController.abort();
				},
				{ signal: abortController.signal }
			);
		});
	}

	get nodeEditor(): NodeEditorElement | null {
		return this[internal].editor ?? null;
	}

	connectedCallback() {
		const I = this[internal];
		I.editor = findAncestorOfType(this, NodeEditorElement);
	}

	disconnectedCallback() {
		const I = this[internal];
		delete I.editor;
	}
}

class NodeEditorElement extends HTMLElement {
	private [internal]: {
		root: HTMLDivElement;
		map?: NodeMapElement;
		resizeObserver: ResizeObserver;
		ports: Map<string, NodePortElement>;
	};

	static get observedAttributes() {
		return ['name', 'x', 'y', 'width', 'height'];
	}

	constructor() {
		super();

		const shadow = this.attachShadow({
			mode: 'closed'
		});

		upgradeProperties.call(this);

		const I = (this[internal] = {
			root: attr(HTML('div'), {
				part: 'frame'
			}),
			resizeObserver: createDebouncedResizeObserver(() =>
				this[updateTransform](true, false)
			),
			ports: new Map()
		});

		Object.assign(I.root.style, {
			position: 'absolute',
			boxSizing: 'border-box'
		});

		I.root.appendChild(HTML('slot'));
		shadow.appendChild(I.root);

		this.addEventListener('online', e => {
			const I = this[internal];
			const port = (<NodePortOnlineEvent>e).port;
			if (port.name) {
				const existing = I.ports.get(port.name);
				if (existing && existing !== port) {
					console.warn(
						'ignoring port with duplicate name:',
						port.name
					);
					return;
				}
				I.ports.set(port.name, port);
			}
		});

		this.addEventListener('offline', e => {
			const I = this[internal];
			const port = (<NodePortOfflineEvent>e).port;
			if (port.name) {
				const existing = I.ports.get(port.name);
				if (existing && existing === port) {
					I.ports.delete(port.name);
				}
			}
		});

		this.addEventListener('name', e => {
			const I = this[internal];
			const { target, oldName } = <NodeNameEvent>e;

			if (target instanceof NodePortElement) {
				if (oldName) {
					const existing = I.ports.get(oldName);
					if (existing && existing === target) {
						I.ports.delete(oldName);
					}
				}

				if (target.name) {
					const existing = I.ports.get(target.name);
					if (existing && existing !== target) {
						console.warn(
							'ignoring port with duplicate name:',
							target.name
						);
					} else {
						I.ports.set(target.name, target);
					}
				}
			}
		});
	}

	getPort(name: string): NodePortElement | null {
		return this[internal].ports.get(name) ?? null;
	}

	connectedCallback() {
		const I = this[internal];

		I.map = findAncestorOfType(this, NodeMapElement);

		this.dispatchEvent(new NodeEditorAddEvent(this));

		upgradeAll(this, 'node-port', NodePortElement);
		upgradeAll(this, 'node-title', NodeTitleElement);

		I.resizeObserver.observe(I.root);
	}

	disconnectedCallback() {
		const I = this[internal];

		const ev = new NodeEditorRemoveEvent(this);
		this.dispatchEvent(ev);
		if (ev.bubbles && !ev.cancelBubble) I.map?.dispatchEvent(ev);

		delete I.map;

		I.resizeObserver.unobserve(I.root);
	}

	get nodeMap(): NodeMapElement | null {
		return this[internal].map ?? null;
	}

	get x(): number {
		return parseInt(this.getAttribute('x') || '0', 10);
	}

	set x(v: number | string | null) {
		if (v === null) this.removeAttribute('x');
		else this.setAttribute('x', v.toString());
	}

	get y(): number {
		return parseInt(this.getAttribute('y') || '0', 10);
	}

	set y(v: number | string | null) {
		if (v === null) this.removeAttribute('y');
		else this.setAttribute('y', v.toString());
	}

	get name(): string | null {
		return this.getAttribute('name');
	}

	set name(v: string | null) {
		if (v === null) this.removeAttribute('name');
		else this.setAttribute('name', v);
	}

	get width(): number {
		const attributeValue = this.getAttribute('width');
		return attributeValue === null
			? this[internal].root.getBoundingClientRect().width
			: parseInt(attributeValue, 10);
	}

	set width(v: number | string | null) {
		if (v === null) this.removeAttribute('width');
		else this.setAttribute('width', v.toString());
	}

	get height(): number {
		const attributeValue = this.getAttribute('height');
		return attributeValue === null
			? this[internal].root.getBoundingClientRect().height
			: parseInt(attributeValue, 10);
	}

	set height(v: number | string | null) {
		if (v === null) this.removeAttribute('height');
		else this.setAttribute('height', v.toString());
	}

	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null
	) {
		switch (name) {
			case 'x':
			case 'y':
				this[updateTransform](false, true);
				break;
			case 'width':
			case 'height':
				this[updateTransform](true, false);
				break;
			case 'name':
				if (newValue !== oldValue) {
					this.dispatchEvent(new NodeNameEvent(newValue, oldValue));
				}
				break;
		}
	}

	private [updateTransform](didResize: boolean, didMove: boolean) {
		const I = this[internal];

		I.root.style.left = `${this.x}px`;
		I.root.style.top = `${this.y}px`;

		const maybeWidth = this.getAttribute('width');
		if (maybeWidth !== null)
			I.root.style.width = `${parseInt(maybeWidth, 10)}px`;
		const maybeHeight = this.getAttribute('height');
		if (maybeHeight !== null)
			I.root.style.height = `${parseInt(maybeHeight, 10)}px`;

		// force re-layout
		void I.root.offsetWidth;

		this.dispatchEvent(
			new NodeEditorTransformEvent({
				x: this.x,
				y: this.y,
				width: this.width,
				height: this.height,
				didResize,
				didMove
			})
		);
	}
}

class NodeLinkElement extends HTMLElement {
	private [internal]: {
		map?: NodeMapElement;
		elem: SVGGElement;
		rootElem: SVGGElement;
		pathElem: SVGPathElement;
		fromColorElem: SVGStopElement;
		toColorElem: SVGStopElement;
		gradientElem: SVGLinearGradientElement;
		fromPort: NodePortElement | null;
		toPort: NodePortElement | null;
		refreshAbort?: AbortController;
		connected: boolean;
	};

	static get observedAttributes() {
		return ['from', 'in', 'to', 'out'];
	}

	constructor() {
		super();

		this.attachShadow({ mode: 'closed' });

		upgradeProperties.call(this);

		// *sigh*
		const gradId = `linkgrad${Math.random().toString().slice(2)}`;

		const I = (this[internal] = {
			elem: SVG('g'),
			rootElem: SVG('g'),
			pathElem: attr(SVG('path'), {
				part: 'link',
				stroke: `url(#${gradId})`,
				'stroke-width': PATH_WIDTH,
				fill: 'none',
				d: 'M0,0'
			}),
			fromColorElem: attr(SVG('stop'), {
				offset: '25%',
				'stop-color': DEFAULT_PORT_COLOR
			}),
			toColorElem: attr(SVG('stop'), {
				offset: '75%',
				'stop-color': DEFAULT_PORT_COLOR
			}),
			fromPort: null,
			toPort: null,
			gradientElem: attr(SVG('linearGradient'), {
				id: gradId,
				gradientUnits: 'userSpaceOnUse',
				x1: '0',
				y1: '0',
				x2: '0',
				y2: '0'
			}),
			connected: false
		});

		I.gradientElem.appendChild(I.fromColorElem);
		I.gradientElem.appendChild(I.toColorElem);
		I.rootElem.appendChild(I.gradientElem);
		I.rootElem.appendChild(I.pathElem);
	}

	get nodeMap(): NodeMapElement | null {
		return this[internal].map ?? null;
	}

	get fromName(): string | null {
		return this.getAttribute('from') || null;
	}

	set fromName(v: string | null) {
		if (v === null) this.removeAttribute('from');
		else this.setAttribute('from', v);
	}

	get toName(): string | null {
		return this.getAttribute('to') || null;
	}

	set toName(v: string | null) {
		if (v === null) this.removeAttribute('to');
		else this.setAttribute('to', v);
	}

	get inName(): string | null {
		return this.getAttribute('in') ?? null;
	}

	set inName(v: string | null) {
		if (v === null) this.removeAttribute('in');
		else this.setAttribute('in', v);
	}

	get outName(): string | null {
		return this.getAttribute('out') ?? null;
	}

	set outName(v: string | null) {
		if (v === null) this.removeAttribute('out');
		else this.setAttribute('out', v);
	}

	get inPort(): NodePortElement | null {
		return this[internal].toPort;
	}

	get outPort(): NodePortElement | null {
		return this[internal].fromPort;
	}

	private [notifyConnection](
		connected: boolean,
		fromPort: NodePortElement | null,
		toPort: NodePortElement | null
	) {
		const I = this[internal];
		if (I.connected === connected) return;

		if (connected) {
			this.dispatchEvent(new NodeConnectEvent(this, true));
			(<NodePortElement>fromPort).dispatchEvent(
				new NodeConnectEvent(this, false)
			);
			(<NodePortElement>toPort).dispatchEvent(
				new NodeConnectEvent(this, false)
			);
		} else {
			const ev = new NodeDisconnectEvent(this, true);
			this.dispatchEvent(ev);
			if (!this.parentNode && !ev.cancelBubble) {
				I.map?.dispatchEvent(ev);
			}
			if (fromPort)
				fromPort.dispatchEvent(new NodeDisconnectEvent(this, false));
			if (toPort)
				toPort.dispatchEvent(new NodeDisconnectEvent(this, false));
		}

		I.connected = connected;
	}

	private [refreshConnection](forceDisconnect: boolean = false) {
		const I = this[internal];

		let newFromEditor: NodeEditorElement | null;
		let newToEditor: NodeEditorElement | null;
		let newFromPort: NodePortElement | null;
		let newToPort: NodePortElement | null;

		try {
			this[notifyConnection](false, I.fromPort, I.toPort);

			I.rootElem.remove();
			I.refreshAbort?.abort();

			const map = I.map;
			if (!map || forceDisconnect) return;

			const { toName, fromName, inName, outName } = this;
			if (!(toName && fromName && inName && outName)) return;

			newFromEditor = map.getEditor(fromName);
			newToEditor = map.getEditor(toName);

			if (!newFromEditor || !newToEditor) return;

			newFromPort = newFromEditor.getPort(outName);
			newToPort = newToEditor.getPort(inName);

			if (!newFromPort || !newToPort) return;
		} finally {
			I.fromPort = null;
			I.toPort = null;
		}

		I.refreshAbort = new AbortController();

		newFromPort.addEventListener(
			'position',
			() => this[refreshPosition](),
			{
				passive: true,
				signal: I.refreshAbort.signal
			}
		);

		newToPort.addEventListener('position', () => this[refreshPosition](), {
			passive: true,
			signal: I.refreshAbort.signal
		});

		newFromPort.addEventListener('offline', () => this.remove(), {
			signal: I.refreshAbort.signal
		});

		newToPort.addEventListener('offline', () => this.remove(), {
			signal: I.refreshAbort.signal
		});

		newFromPort.addEventListener('color', () => this[refreshColor](), {
			signal: I.refreshAbort.signal
		});

		newToPort.addEventListener('color', () => this[refreshColor](), {
			signal: I.refreshAbort.signal
		});

		newFromPort.addEventListener(
			'name',
			() => this[refreshConnection](true),
			{
				signal: I.refreshAbort.signal
			}
		);

		newToPort.addEventListener(
			'name',
			() => this[refreshConnection](true),
			{
				signal: I.refreshAbort.signal
			}
		);

		newFromEditor.addEventListener(
			'name',
			() => this[refreshConnection](true),
			{
				signal: I.refreshAbort.signal
			}
		);

		newToEditor.addEventListener(
			'name',
			() => this[refreshConnection](true),
			{
				signal: I.refreshAbort.signal
			}
		);

		I.fromPort = newFromPort;
		I.toPort = newToPort;

		this[refreshPosition]();
		this[refreshColor]();

		I.rootElem.addEventListener('mousedown', e => e.preventDefault(), {
			signal: I.refreshAbort.signal
		});

		I.rootElem.addEventListener(
			'dblclick',
			e => {
				e.preventDefault();
				e.stopPropagation();
				this.remove();
			},
			{
				signal: I.refreshAbort.signal
			}
		);

		I.elem.appendChild(I.rootElem);

		return void this[notifyConnection](true, I.fromPort, I.toPort);
	}

	private [refreshPosition]() {
		const I = this[internal];

		const from = I.fromPort;
		const to = I.toPort;

		if (!from || !to) {
			I.pathElem.setAttribute('d', 'M0 0');
			return;
		}

		attr(I.gradientElem, {
			x1: from.handleX,
			y1: from.handleY,
			x2: to.handleX,
			y2: to.handleY
		});

		setLinkCurve(
			I.pathElem,
			from.handleX,
			from.handleY,
			to.handleX,
			to.handleY
		);
	}

	private [refreshColor]() {
		const I = this[internal];
		I.fromColorElem.setAttribute(
			'stop-color',
			I.fromPort?.color ?? DEFAULT_PORT_COLOR
		);
		I.toColorElem.setAttribute(
			'stop-color',
			I.toPort?.color ?? DEFAULT_PORT_COLOR
		);
	}

	attributeChangedCallback() {
		this.dispatchEvent(new NodeUnlinkEvent(this));
		this.dispatchEvent(new NodeLinkEvent(this));
		this[refreshConnection]();
	}

	connectedCallback() {
		const I = this[internal];
		I.map = findAncestorOfType(this, NodeMapElement);
		this.dispatchEvent(new NodeLinkEvent(this));
		this[refreshConnection]();
	}

	disconnectedCallback() {
		const I = this[internal];
		const ev = new NodeUnlinkEvent(this);
		this.dispatchEvent(ev);
		if (ev.bubbles && !ev.cancelBubble) I.map?.dispatchEvent(ev);
		this[refreshConnection](true);
		delete I.map;
	}
}

class NodeCanvas extends EventTarget {
	elem: SVGSVGElement;
	root: SVGSVGElement;
	panX: number;
	panY: number;
	width: number;
	height: number;
	zoom: number;
	pattern: SVGPatternElement;

	constructor() {
		super();

		this.elem = SVG('svg');
		this.root = SVG('svg');
		this.pattern = SVG('pattern');
		this.width = 0;
		this.height = 0;
		this.panX = 0;
		this.panY = 0;
		this.zoom = 1;

		this.elem.classList.add('node-canvas-base');
		this.root.classList.add('node-canvas-root');

		this.root.style.overflow = 'visible';

		const bgDot = attr(SVG('circle'), {
			fill: 'rgba(127,127,127,0.3)',
			r: GRID_DOT_RADIUS,
			cx: GRID_DOT_RADIUS,
			cy: GRID_DOT_RADIUS
		});

		const bgRect = attr(SVG('rect'), {
			fill: 'url(#nodebg)',
			width: '100%',
			height: '100%'
		});

		let dragging = false;
		let dragStart = [0, 0, 0, 0];

		const onDrag = (e: PointerEvent) => {
			const newX = dragStart[0] + (e.clientX - dragStart[2]) / this.zoom;
			const newY = dragStart[1] + (e.clientY - dragStart[3]) / this.zoom;
			this.setPan(newX, newY);
		};

		this.elem.addEventListener('mousedown', e => e.preventDefault());

		this.elem.addEventListener('pointerdown', e => {
			if (dragging) return;
			if (e.button !== 0 && e.button !== 1) return;

			if (
				e.target !== this.elem &&
				e.target !== this.root &&
				e.target !== bgRect
			) {
				return;
			}

			dragStart = [this.panX, this.panY, e.clientX, e.clientY];

			this.elem.setPointerCapture(e.pointerId);
			this.elem.addEventListener('pointermove', onDrag);
			dragging = true;
			this.dispatchEvent(new NodeMapViewportStartEvent());
		});

		this.elem.addEventListener('pointerup', e => {
			this.elem.releasePointerCapture(e.pointerId);
			this.elem.removeEventListener('pointermove', onDrag);
			dragging = false;
			this.dispatchEvent(new NodeMapViewportStopEvent());
		});

		this.elem.addEventListener(
			'wheel',
			e => {
				if (dragging) return;
				this.pan(-e.clientX / this.zoom, -e.clientY / this.zoom);
				this.setZoom(
					this.zoom +
						-Math.sign(e.deltaY) *
							ZOOM_RATE *
							Math.pow(this.zoom, 0.0001)
				);
				this.pan(e.clientX / this.zoom, e.clientY / this.zoom);
			},
			{ passive: true }
		);

		this.pattern.id = 'nodebg';
		attr(this.pattern, {
			viewBox: `0 0 ${GRID_RESOLUTION} ${GRID_RESOLUTION}`,
			width: GRID_RESOLUTION,
			height: GRID_RESOLUTION,
			patternUnits: 'userSpaceOnUse'
		});

		this.pattern.appendChild(bgDot);
		this.elem.appendChild(this.pattern);
		this.elem.appendChild(bgRect);
		this.elem.appendChild(this.root);
	}

	appendChild(elem: SVGElement) {
		this.root.appendChild(elem);
	}

	viewToWorld(x: number, y: number): [number, number] {
		return [x / this.zoom - this.panX, y / this.zoom - this.panY];
	}

	worldToView(x: number, y: number): [number, number] {
		return [(x + this.panX) * this.zoom, (y + this.panY) * this.zoom];
	}

	getPan(): [number, number] {
		return [this.panX, this.panY];
	}

	setPan(x: number, y: number) {
		this.panX = x;
		this.panY = y;

		attr(this.root, {
			x,
			y
		});

		attr(this.pattern, {
			x,
			y
		});

		this.dispatchEvent(new NodeMapViewportEvent(x, y, this.zoom));
	}

	pan(x: number, y: number) {
		this.setPan(this.panX + x, this.panY + y);
	}

	setSize(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.updateTransform();
	}

	setZoom(zoom: number) {
		this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
		this.updateTransform();
		this.dispatchEvent(
			new NodeMapViewportEvent(this.panX, this.panY, this.zoom)
		);
	}

	updateTransform() {
		this.elem.setAttribute(
			'viewBox',
			`0 0 ${this.width / this.zoom} ${this.height / this.zoom}`
		);
	}
}

class NodeMapElement extends HTMLElement {
	private [internal]: {
		canvas: NodeCanvas;
		editorCanvas: HTMLDivElement;
		resizeObserver: ResizeObserver;
		editors: Map<string, NodeEditorElement>;
		links: Set<NodeLinkElement>;
		ports: Map<NodePortElement, AbortController>;
		connections: Map<NodePortElement, NodePortElement>;
	};

	constructor() {
		super();

		const shadow = this.attachShadow({
			mode: 'closed'
		});

		const I = (this[internal] = {
			canvas: new NodeCanvas(),
			editorCanvas: HTML('div'),
			resizeObserver: createDebouncedResizeObserver((width, height) =>
				this[internal].canvas.setSize(width, height)
			),
			editors: new Map(),
			links: new Set(),
			ports: new Map(),
			connections: new Map() // TODO actually populate
		});

		const style = HTML('style');
		const root = HTML('div');

		shadow.appendChild(style);
		shadow.appendChild(root);
		root.appendChild(I.canvas.elem);
		root.appendChild(I.editorCanvas);

		I.canvas.elem.setAttribute('part', 'background');

		I.editorCanvas.appendChild(HTML('slot'));
		I.editorCanvas.classList.add('canvas');

		I.canvas.addEventListener('viewport', e => {
			e.stopPropagation();
			const { zoom, offsetX, offsetY } = <NodeMapViewportEvent>e;
			const transform = `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`;
			I.editorCanvas.style.transform = transform;
		});

		I.canvas.addEventListener('viewportstart', e => {
			e.stopPropagation();
			this.classList.add('panning');
		});

		I.canvas.addEventListener('viewportstop', e => {
			e.stopPropagation();
			this.classList.remove('panning');
		});

		style.textContent = `
			:host {
				display: flex;
				flex-wrap: wrap;
				height: 100%;
				overflow: hidden;
			}

			:host > div {
				width: 100%;
				height: 100%;
				position: relative;
				display: block;
				overflow: hidden;
			}

			:host > div > .canvas {
				pointer-events: none;
				transform-origin: top left;
			}

			:host > div > .canvas > * {
				pointer-events: auto;
			}

			:host > div > * {
				position: absolute;
				left: 0;
				top: 0;
				width: 100%;
				height: 100%;
			}
		`;

		const addPort = (port: NodePortElement) => {
			if (I.ports.has(port)) return;

			const controller = new AbortController();
			I.ports.set(port, controller);

			port.addEventListener(
				'pointerdown',
				e => {
					if (e.button !== 0) return;

					const pointerId = e.pointerId;
					this.setPointerCapture(e.pointerId);

					const dragAbort = new AbortController();

					const linkMarkerElem = attr(SVG('path'), {
						stroke: port.color,
						'stroke-width': PATH_WIDTH,
						fill: 'none',
						d: `M${port.handleX} ${port.handleY}`
					});
					let lastTargetPort: null | NodePortElement = null;

					dragAbort.signal.addEventListener('abort', () =>
						linkMarkerElem.remove()
					);

					I.canvas.appendChild(linkMarkerElem);

					this.addEventListener(
						'pointermove',
						e => {
							const isOut = port.hasAttribute('out');
							lastTargetPort = null;

							const maybeElem = document.elementFromPoint(
								e.pageX,
								e.pageY
							);

							if (maybeElem) {
								const elem: NodePortElement | undefined =
									findAncestorOfType<NodePortElement>(
										maybeElem,
										NodePortElement
									);

								if (
									elem &&
									elem !== port &&
									isOut !== elem.hasAttribute('out') &&
									port.nodeEditor !== elem.nodeEditor
								) {
									lastTargetPort = elem;
								}
							}

							const startPoint: [number, number] = [
								port.handleX,
								port.handleY
							];
							const endPoint: [number, number] = lastTargetPort
								? [
										lastTargetPort.handleX,
										lastTargetPort.handleY
								  ]
								: I.canvas.viewToWorld(
										e.pageX - this.offsetLeft,
										e.pageY - this.offsetTop
								  );

							setLinkCurve(
								linkMarkerElem,
								...(isOut ? startPoint : endPoint),
								...(isOut ? endPoint : startPoint)
							);
						},
						{ signal: dragAbort.signal }
					);

					document.addEventListener(
						'pointerup',
						e => {
							if (e.pointerId !== pointerId) return;
							this.releasePointerCapture(e.pointerId);
							dragAbort.abort();

							if (
								lastTargetPort &&
								!I.connections.get(port)?.has(lastTargetPort) &&
								port.nodeEditor?.name &&
								lastTargetPort.nodeEditor?.name &&
								port.name &&
								lastTargetPort.name
							) {
								const a = [port.nodeEditor.name, port.name];
								const b = [
									lastTargetPort.nodeEditor.name,
									lastTargetPort.name
								];

								const forward =
									port.isOutputPort &&
									!lastTargetPort.isOutputPort;

								this.appendChild(
									attr(HTML('node-link'), {
										from: forward ? a[0] : b[0],
										to: forward ? b[0] : a[0],
										out: forward ? a[1] : b[1],
										in: forward ? b[1] : a[1]
									})
								);
							}
						},
						{ signal: dragAbort.signal }
					);
				},
				{ signal: controller.signal }
			);
		};

		const removePort = (port: NodePortElement) => {
			if (!I.ports.has(port)) return;
			I.ports.get(port).abort();
			I.ports.delete(port);
		};

		const createBoundary = (name: string) =>
			this.addEventListener(name, e => e.stopPropagation());
		createBoundary('transform');
		createBoundary('position');
		createBoundary('color');

		this.addEventListener('connect', e => {
			e.stopPropagation();

			const link = (<NodeConnectEvent>e).link;
			const set = I.connections.get(link.outPort);
			if (set) {
				set.add(link.inPort);
			} else {
				I.connections.set(link.outPort, new Set([link.inPort]));
			}
		});

		this.addEventListener('disconnect', e => {
			e.stopPropagation();

			const link = (<NodeConnectEvent>e).link;
			const set = I.connections.get(link.outPort);
			if (set) {
				set.delete(link.inPort);
				if (set.size === 0) I.connections.delete(link.outPort);
			}
		});

		this.addEventListener('online', e => {
			e.stopPropagation();

			const port = (<NodePortOnlineEvent>e).port;
			addPort(port);
		});

		this.addEventListener('offline', e => {
			e.stopPropagation();

			const port = (<NodePortOnlineEvent>e).port;
			removePort(port);
		});

		this.addEventListener('add', e => {
			e.stopPropagation();

			const editor = (<NodeEditorAddEvent>e).editor;
			if (editor.name) {
				const existing = I.editors.get(editor.name);
				if (existing && existing !== editor) {
					console.warn(
						'ignoring editor with duplicate name:',
						editor.name
					);
					return;
				}
				I.editors.set(editor.name, editor);
			}
		});

		this.addEventListener('remove', e => {
			e.stopPropagation();

			const editor = (<NodeEditorRemoveEvent>e).editor;
			if (editor.name) {
				const existing = I.editors.get(editor.name);
				if (existing && existing === editor) {
					I.editors.delete(editor.name);
				}
			}
		});

		this.addEventListener('name', e => {
			e.stopPropagation();

			const { target, oldName } = <NodeNameEvent>e;

			if (target instanceof NodeEditorElement) {
				if (oldName) {
					const existing = I.editors.get(oldName);
					if (existing && existing === target) {
						I.editors.delete(oldName);
					}
				}

				if (target.name) {
					const existing = I.editors.get(target.name);
					if (existing && existing !== target) {
						console.warn(
							'ignoring editor with duplicate name:',
							target.name
						);
					} else {
						I.editors.set(target.name, target);
					}
				}
			} else if (target instanceof NodePortElement) {
				if (oldName && !target.name) removePort(target);
				else if (!oldName && target.name) addPort(target);
			}
		});

		this.addEventListener('link', e => {
			e.stopPropagation();

			const link = e.target;
			if (link instanceof NodeLinkElement) {
				const I = this[internal];
				I.links.add(link);
				I.canvas.appendChild(link[internal].elem);
			}
		});

		this.addEventListener('unlink', e => {
			e.stopPropagation();

			const link = e.target;
			if (link instanceof NodeLinkElement) {
				const I = this[internal];
				I.links.delete(link);
				link[internal].elem.remove();
			}
		});
	}

	getEditor(name: string): NodeEditorElement | null {
		return this[internal].editors.get(name) ?? null;
	}

	get zoom(): number {
		return this[internal].canvas.zoom;
	}

	connectedCallback() {
		upgradeAll(this, 'node-editor', NodeEditorElement);
		upgradeAll(this, 'node-link', NodeLinkElement);

		this[internal].resizeObserver.observe(this);
	}

	disconnectedCallback() {
		this[internal].resizeObserver.unobserve(this);
	}
}

function defineTag<T extends HTMLElement>(tag: string, cls: new () => T) {
	customElements.define(tag, cls);
	document
		.querySelectorAll(tag)
		.forEach(
			node => !(node instanceof cls) && customElements.upgrade(node)
		);
}

defineTag('node-map', NodeMapElement);
defineTag('node-editor', NodeEditorElement);
defineTag('node-title', NodeTitleElement);
defineTag('node-port', NodePortElement);
defineTag('node-link', NodeLinkElement);

export {
	NodeTitleElement,
	NodePortElement,
	NodeEditorElement,
	NodeLinkElement,
	NodeMapElement,
	NodeEditorTransformEvent,
	NodePortPositionEvent,
	NodePortColorEvent,
	NodePortOnlineEvent,
	NodePortOfflineEvent,
	NodeEditorAddEvent,
	NodeEditorRemoveEvent,
	NodeNameEvent,
	NodeLinkEvent,
	NodeUnlinkEvent,
	NodeConnectEvent,
	NodeDisconnectEvent
};
