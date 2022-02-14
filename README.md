# Node Editor (Web Components)

<center>
<img alt="Screenshot of the node editor component demo" src="https://github.com/Qix-/node-editor/raw/master/screenshot.png" />
</center>
<br />

A zero dependency, unopinionated
[node editor](https://en.wikipedia.org/wiki/Node_graph_architecture#Node_Graph)
built as a reusable
[web component](https://developer.mozilla.org/en-US/docs/Web/Web_Components).

## Features

-   **Zero dependencies.** Just import and you're off!
-   **Fully-compliant web components.** Works with React, Vue, Surplus,
    or vanilla Javascript applications.
-   **Unopinionated.** Style nodes how you want, customizing everything
    down to the port handles themselves. Completely stylable.
-   **Delightful.** Modeled after the excellent Blender geometry nodes
    and Unity's editor system, great care was made to make it feel
    nice to use and to look pretty.

## Installation

This library is distributed as an ESM module and released on npm.

```
npm install node-editor
```

While the module itself exports all of the public types
if you need them, it is not _strictly_ necessary to use
the library, and the code is otherwise self-contained/-executing.

Assuming you're using a bundler or a `<script type="module">` tag,
you simply need to `import` it.

```javascript
import 'node-editor';
```

From there, you can create HTML tags via `document.createElement()`
or with plain HTML directly in an `.html` file; the library will
automatically upgrade any existing elements found on the page.

## Usage

> **A note on stability:** `node-editor` is currently in beta
> stage, and thus the public API/tags might change slightly.
> Expect bugs (seriously, the logic is quite hairy).
> Use at your own risk, and
> [please report](https://github.com/qix-/node-editor/issues/new)
> any issues you face!

`node-editor` provides absolutely no "functionality", processing
engine, or built-in nodes. It merely gives you the display components
for building your own nodes and receiving information about
how the user has connected them together.

How the node system reacts to inputs is entirely up to the application
developer; `node-editor` makes no assumptions there - it is purely
the display component.

A very basic overview of the components that are exposed:

```html
<node-map>
	<node-editor name="unique-name" width="200">
		<node-title>
			This part is draggable, and moves the entire editor. Use it for node
			titles, title bars, etc.
		</node-title>

		<node-port name="unique-name" color="red">
			A port is created here. Any content is automatically resized and the
			port handle is automatically placed in the vertical-middle. By
			default, ports are inputs...
		</node-port>

		<node-port out name="unique-name2" color="blue">
			... but can be specified as outputs by adding the `out` attribute.
		</node-port>
	</node-editor>

	<!-- in/out ports must be children of their respective editors -->
	<node-link
		from="src-editor-name"
		to="dest-editor-name"
		out="src-port-name"
		in="dest-port-name"
	>
		<!--
			You MUST have a closing tag, but nothing
			here will actually display. For now, please
			treat it as a "reserved" space and keep it
			empty, as there might be a feature added
			that uses this space later on.
		-->
	</node-link>
</node-map>
```

### `<node-map>` (`NodeEditorElement` -> [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement))

The `NodeMapElement` is the root element for a node editor. All other
`node-editor` components must lay within a `<node-map>` element; at best,
they will simply do nothing if they are not.

Note that coordinates in almost all cases refer to "world coordinates", or
the coorindates that make up the infinite scrollable plane of the editor
map itself. That is to say, zooming and panning the editor does not change
the world coordinates of the elements within it.

> **NOTE:** By design, `<node-map>` elements are nestable (as in, you
> should be able to create a `<node-map>` within a `<node-editor>` without
> issue). This is largely untested, but _should_ work. Please open any
> issues you have if you end up relying on this feature.

#### Events

The `<node-map>` element creates an event boundary; all `node-editor`-related
events will stop bubbling once they hit their respective `<node-map>` element.

-   `transform` (`NodeEditorTransformEvent`) - an editor was moved or changed size
    -   `event.target` - the `<node-editor>` (`NodeEditorElement`) element
    -   `event.x` / `event.y` - the new map position of the editor in world coordinates
    -   `event.width` / `event.height` - the new size of the editor in world coordinates
    -   `event.didResize` - `true` if the editor resized
    -   `event.didMove` - `true` if the editor changed position
-   `position` (`NodePortPositionEvent`) - a port within an editor changed position
    -   `event.target` - the `<node-port>` (`NodePortElement`) element
    -   `event.x` / `event.y` - the new position of the port in world coordinates
-   `color` (`NodePortColorEvent`) - a port within an editor changed its color
    -   `event.target` - the `<node-port>` (`NodePortElement`) element
    -   `event.color` - the new color, as a [CSS color string](https://developer.mozilla.org/en-US/docs/Web/CSS/color)
-   `online` (`NodePortOnlineEvent`) - a port was created within an editor
    -   `event.target` - the `<node-port>` (`NodePortElement`) element
    -   `event.port` - same as `event.target`
-   `offline` (`NodePortOfflineEvent`) - a port was deleted from an editor
    -   `event.target` - the `<node-editor>` (`NodeEditorElement`) element that held the port
    -   `event.port` - the `<node-port>` (`NodePortElement`) that was deleted
-   `add` (`NodeEditorAddEvent`) - an editor was added to the map
    -   `event.target` - the `<node-editor>` (`NodeEditorElement`) element that was added
    -   `event.editor` - same as `event.target`
-   `remove` (`NodeEditorRemoveEvent`) - an editor was removed from the map
    -   `event.target` - the `<node-map>` (`NodeMapElement`) element from which the editor was removed
    -   `event.editor` - the removed `<node-editor>` (`NodeEditorElement`) element
-   `link` (`NodeLinkEvent`) - a `<node-link>` was added to the map
    (**note:** does NOT mean a connection was made - see the `connect` event)
    -   `event.target` - the `<node-link>` (`NodeLinkElement`) element
    -   `event.link` - same as `event.target`
-   `unlink` (`NodeUnlinkEvent`) - a `<node-link>` was removed from the map
    -   `event.target` - the `<node-map>` (`NodeMapElement`) element from which the link was removed
    -   `event.link` - the `<node-link>` (`NodeLinkElement`) that was removed
    -   **NOTE:** In the event of an attribute change, an `unlink` event will immediately be followed
        by a `link` event. In such a case, the `unlink` event's `event.link`'s attributes
        will always reflect the updated values, and do not track the old attribute values
        in _any_ case. It is up to the application developer to keep track of old link
        values if they need them.
-   `connect` (`NodeConnectEvent`) - a `<node-link>` successfully formed a connection between two ports
    -   `event.target` - the `<node-link>` (`NodeLinkElement`) element
    -   `event.link` - same as `event.target`
-   `disconnect` (`NodeDisconnectEvent`) - a `<node-link>` lost its connection
    -   `event.target` - the `<node-map>` (`NodeMapElement`) element from which the link was removed
    -   `event.link` - the `<node-link>` (`NodeLinkElement`) that was removed
    -   **NOTE:** `event.link`'s attributes will always reflect the updated values, and do not
        track the old attribute values in _any_ case. It is up to the application developer to
        keep track of old link values if they need them.
-   `name` (`NodeNameEvent`) - a `<node-editor>` or `<node-port>` changed its `name` attribute
    -   `event.target` - the `<node-editor>` (`NodeEditorElement`) **or** `<node-port>` (`NodePortElement`)
    -   `event.name` - the new name, or `null` if the name attribute was removed
    -   `event.oldName` - the old name, or `null` if the name attribute was just added

#### Properties

-   `zoom` _(read-only)_ - the current zoom value (`1` = 100%, lesser values = zoomed out)

#### Methods

-   `getEditor(name)` - get an editor by its `name` attribute; returns `null` if not found

#### Styling

-   Selector `::part(background)` - targets the SVG background element. Use this selector
    to specify e.g. `cursor: grab`.
-   Selector `::part(link)` - target the SVG bezier curves that constitute link lines.
    Use this selector to specify e.g. `cursor: finger` (to indicate that the link can be
    double-clicked to be removed).
-   Class `.dragging` - added during click+drag panning event. Use this class to
    specify e.g. `cursor: grabbing`.

### `<node-editor>` (`NodeEditorElement` -> [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement))

The `<node-editor>` tag is the container for individual draggable/resizable nodes.

All `<node-editor>` tags must be defined within a `<node-map>`.

#### Events

The following events might be dispatched from `<node-editor>` elements.
See the documentation under `<node-map>` for what they mean. Additional
notes or exceptions are added as sub-points.

-   `transform`
-   `position`
-   `color`
-   `online`
-   `offline`
-   `add`
-   `remove`
    -   `event.target` is the `<node-element>` (`NodeEditorElement`) that was removed
    -   `event.editor.nodeMap` is still valid during the callback, and refers to the
        `<node-map>` (`NodeMapElement`) from which the editor was removed.
-   `connect`
-   `disconnect`
-   `name`

#### Properties

-   `nodeMap` _(read-only)_ - the `<node-map>` (`NodeMapElement`) that parents this element (or `null`
    if this editor is orphaned)
-   `x`/`y` - the top-left position of the editor in world coordinates
-   `name` - the `name` attribute, or `null` if not set
-   `width`/`height` - the editor's width/height in world coordinates; retrieved either
    from the `width`/`height` attributes respectively, or calculated based on the editors's
    contents.

#### Attributes

The following `<node-editor>` attributes mirror their respective properties; see the above
section for more information.

-   `name`
    -   **Must exist** for the editor to be functional.
    -   **Must be unique** (within its respective `<node-map>`) to be functional.
        A console warning will be emitted if the name collides with another editor.
-   `x` / `y` _(optional)_
    -   Default to `0`
    -   Must be numeric; values denote number of pixels. They do not accept unit suffixes.
-   `width`/`height` _(optional)_
    -   If not specified, the editor's content can specify its own width/height.
    -   It is generally encouraged to add at least a `width` attribute; height will still
        automatically resize as expected.
    -   Must be numeric; values denote number of pixels. They do not accept unit suffixes.

#### Methods

-   `getPort(name)` - gets a `<node-port>` (`NodePortElement`) by its `name` attribute, or `null` if
    no port exists by that name

#### Styling

-   Selector `::part(frame)` - targets the root element of the editor. Use this selector
    to define the basic 'frame' shape, color, etc (e.g. `background`, `border-radius`,
    `box-shadow`, etc.)

### `<node-port>` (`NodePortElement` -> [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement))

The `<node-port>` is a container element that creates either an input or an output port
on a node editor. Ports can be connected to one another to indicate "links", typically
indicating some relationship or flowing of data between two points in the node system.

Since `node-editor` is largely unopinionated, it is up to the application developer
what a port or a link actually represents - only the following is enforced by this
library:

-   An output port cannot be connected to an output port
-   An input port cannot be connected to an input port
-   An output node on some editor X cannot be connected to the input port
    of the same editor X (no self loops).
-   Only one link between a tuple of {output,input} ports can exist.

The following are expressly **not** enforced (and thus would have to be
implemented by the application if it so chooses):

-   Single-connection ports. By default, all input ports can have multiple
    links to them. It is up to the application developer to remove any other
    links if they wish to enforce a single-input system.
-   Port types. By default, all output ports can connect to all input ports,
    regardless of their `color` attribute.

Port "handles" (the visible element where link lines connect to) are by default
colored circles, but can be overridden and thus customized by adding elements
to the `handle` slot (see _Slots_ below).

#### Events

The following events might be dispatched from `<node-port>` elements.
See the documentation under `<node-map>` for what they mean. Additional
notes or exceptions are added as sub-points.

-   `position`
-   `color`
-   `online`
-   `offline`
    -   `event.target` is the `<node-port>` (`NodePortElement`) that was removed
    -   `event.target.nodeEditor` is still valid during the callback, and refers to the
        `<node-editor>` (`NodeEditorElement`) from which the port was removed.
-   `connect`
    -   Does not bubble; a separate event is dispatched from the `<node-link>` itself.
-   `disconnect`
    -   Does not bubble; a separate event is dispatched from the `<node-link>` itself.
-   `name`

> **NOTE:** The way that the `connect` and `disconnect` events are dispatched
> may change prior to the v1 release.

#### Properties

-   `numConnections` _(read-only)_ - the current number of connected links to this port
-   `connections` _(read-only)_ - an array of connected links to this port (in no particular
    order; could be random from reference to reference!)
-   `name` - the `name` attribute, or `null` if not set
-   `nodeEditor` _(read-only)_ - the `<node-editor>` (`NodeEditorElement`) that parents
    this port, or `null` if this port is an orphan
-   `color` - the [CSS color string](https://developer.mozilla.org/en-US/docs/Web/CSS/color)
    of the port; affects the link line color, which will gradient if the two ports have
    different colors. Pulls first from the `color` attribute if specified, or otherwise
    returns the internally defined default color - always returning a string.
-   `isOutputPort` - Whether or not the port is an output port. Returns true if `out` exists
    as an attribute on the element (the value is ignored). Assigning `true` to this property
    adds the `out` attribute; assigning `false` removes it.
-   `handleX` / `handleY` _(read-only)_ - The position of the port's handle in world coordinates

> **NOTE:** You can get the `NodeMapEditor` reference for a
> particular port via the `.nodeEditor?.nodeMap` property.

#### Attributes

The following `<node-port>` attributes mirror their respective properties; see the above
section for more information.

-   `name`
    -   **Must exist** for the port to be functional.
    -   **Must be unique** (within its respective `<node-editor>`) to be functional.
        A console warning will be emitted if the name collides with another port.
-   `out`
    -   Value is ignored. Its mere presence marks the `<node-port>` as an output port.
    -   There is no `in` attribute, but you're welcome to specify one if it helps.
        A lack of `out` attribute indicates an input port.
-   `color`

#### Slots

-   `slot="handle"` - places the element within the port handle element, replacing
    the default port handle. The handle is positioned squarely over the handle 'hotspot'
    location, so that the center of the content is the hotspot point. Note that
    CSS `transform: translate(...)` can be used to offset the visual position of the
    port handle without affecting the functional positioning of the handle itself.

#### Styling

-   Variable `var(--port-color)` - useful for custom handles (via `slot="handle"`)
    to be reusable but also respond to the `color` attribute.

The following are not unique or specific to the library and could
be achieved anyway using normal CSS, but are worthwhile to mention
as more of a 'cookbook'.

-   Selector `[out]` - selects all output ports. Useful for applying e.g.
    `text-align: right`
-   Selector `[connections]` - selects all connected ports. Useful for applying
    e.g. `visibility: hidden`. Especially useful when composed as
    `node-port[connections]:not([out]) > *:not([slot='handle'])`, which only targets
    input node ports that should be hidden if they have connections, but that
    don't also hide custom port handles (if you use them).
    -   This is possible because the `connections` attribute only exists
        if at least once connection exists (i.e. there is never a `connections="0"`
        attribute).

### `<node-title>` (`NodeTitleElement` -> [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement))

The `<node-title>` element is a container element that does nothing other than to
mark an area within a `<node-editor>` as the repositioning handle.

The area making up a `<node-title>` can be clicked+dragged to move the parent
editor element.

If the `<node-title>` is not a child of a `<node-editor>`, it does nothing.

A `<node-editor>` may have multiple `<node-title>` elements.

> **NOTE:** This element may be expanded and thus renamed prior to the v1 release.

#### Properties

-   `nodeEditor` _(read-only)_ - the `<node-editor>` (`NodeEditorElement`) that parents
    this title

### `<node-link>` (`NodeLinkElement` -> [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement))

A `<node-link>` is a nuclear (non-container) element that represents
a connection between an output port and an input `<node-port>` of two separate
`<node-editor>` elements.

> **NOTE:** Despite not being a container element, the Web Components standard
> still mandates that it must have a full closing tag (i.e. `<node-link ...></node_link>`)
> and thus cannot be self-closing (e.g. `<node-link ... />` is, unfortunately,
> not allowed). The latter will cause all of your links to become nested within
> each other.

> **NOTE:** Right now, the contents (child nodes) of `<node-link>` elements
> are simply ignored and do not display anything. However, this may change
> before the v1 release. Please treat the inner contents of `<node-link>`s
> as 'reserved', as adding any content there might cause unexpected results when
> upgrading in the future.

Links can exist without all of their attributes present, or with attributes that
refer to editor(s) and/or port(s) that do not exist. They are not automatically
removed, but instead have a secondary state indicating whether or not they
are "connected".

Links that are missing any one of the four required attributes (`from`, `to`, `in`
and `out`), or in the case where any one of those attributes refers to a missing
editor or port `name`, remain in the disconnected state and do not result in
a link to show up in the editor.

In the event a link is disconnected and a port/editor is either created or has its
`name` changed thus that the four required attributes become collectively 'valid',
then the link enters the connected state whereby the `connect` event is dispatched
and a visual line is formed between the two referenced ports. This also activates
the `fromPort` and `toPort` properties, which hold live references to the connected
`<node-port>` (`NodePortElement`) elements.

`<node-link>` elements present in the DOM but that are otherwise invalid (disconnected)
are never automatically removed from the DOM, either at load or during operation.

Connected links between two ports of differing colors result in a color gradient
between the two.

**Double clicking a connected link line removes it, _including from the DOM._** This
is the only built-in means by which a `<node-link>` can be removed from the DOM.
Of course, application developers are free to remove such elements themselves;
the links will be destroyed as one would expect.

#### Events

The following events might be dispatched from `<node-link>` elements.
See the documentation under `<node-map>` for what they mean. Additional
notes or exceptions are added as sub-points.

-   `link`
-   `unlink`
-   `connect`
-   `disconnect`
    -   `event.target` - the `<node-link>` that was removed
    -   `event.target.nodeMap` is still valid during this callback

#### Properties

-   `nodeMap` _(read-only)_ - the `<node-map>` (`NodeMapElement`) that parents
    this link (or `null` if this link is an orphan)
-   `fromName` / `toName` - the string names of the `<node-editor>` elements
    this link pairs, retrieving directly from the `from` and `to` attributes
    respectively, or returning `null` if those attributes are not present
-   `outName` / `inName` - the string names of the `<node-port>` elements
    this link pairs, retrieving directly from the `out` and `in` attributes
    respectively, or returning `null` if those attributes are not present
-   `outPort` / `inPort` _(read-only)_ - references to the connected
    `<node-port>` (`NodePortElement`) elements, or `null` if the link is
    not connected

#### Attributes

The following `<node-link>` attributes mirror their respective properties; see the above
section for more information.

-   `from` (mirrors the `fromName` property)
-   `to` (mirrors the `toName` property)
-   `out` (mirrors the `outName` property)
-   `in` (mirrors the `inName` property)

Note that **all four** of these attributes must be specified in order for
a `<node-link>` to be eligible for connection, and a connection is only
created if all four refer to valid editor/port names.

## FAQ

Some questions that aren't so much "frequently" asked, but might
come up as you're using the library.

### Why separate `link`/`unlink` and `connect`/`disconnect` events?

One of the "unopinionated" design aspects of the library is that it doesn't
immediately remove any `<node-link>` elements that might have existed
prior to the library being loaded and the custom components being registered.

Thus, a `<node-link>` element can exist/be added to a `<node-map>` that
refers to non-existant editors/ports, which immediately fires off a `link`
event.

It's not until the editors/ports referred to by the `<node-link>` element
come into existence that the `connect` event is fired.

**In most cases, you will only care about the `connect` and `disconnect`
events.**

This may change prior to the v1 release - the usefulness of this approach
has yet to be determined. The motivation was "be as un-destructive as possible"
to the data you feed the components.

### Which browsers does `node-editor` support?

Technically this library works as far back as Chrome 81, but
will leak events and memory all over the place. You need at least
Chrome 88 for this to work properly. This is due to the extensive
use of `AbortController` in `addEventListener()`s, which was
added in Chrome 88.

All other evergreen browsers released around the same time as Chrome 88
should work. If you'd like to contribute a formal table of browser support,
a PR is welcome!

### Does this library use `<foreignObject>`?

No. Foreign objects had a lot of quirks that I didn't particularly
care for, so instead the component uses two layers - an SVG background
for the dots pattern and links' bezier curves, and an upper plain
HTML layer that holds the editor nodes themselves.

Both layers have their viewports synchronized/scaled in tandem, which
achieves the same effect as a `<foreignObject>` but without all of
the limitations/quirks.

### Can I have \_\_\_\_\_\_\_\_\_\_\_\_ feature?

It depends. I'll try to give you an idea of what is considered in/out of scope for
this library (though it never hurts to open an issue anyway).

Things that are **within** the scope of `node-editor`:

-   Facilitating the editing and organizing of nodes
-   Handling input to the extent of the above (creating links between ports, re-
    positioning nodes, etc.)
-   Reacting to content changes within node editors, (custom) port handles, etc.
-   Providing consumers of the libraries adequate control over the behavior
    of the editor, whether it be through events, public API, etc.
-   Performance enhancements
-   Stylistic flexibility

Things that are **outside** the scope of `node-editor`:

-   Any sort of processing or "engine"
-   Dropdowns / toolbars / context menus / ...
-   Default node types or built-in components
-   Port "types" (beyond what is necessary to facilitate egonomic use
    of the library)
-   Enforcing any sort of structural requirements onto node editors
-   Animations

Even if you're unsure, open an issue anyway and ask! Just don't be upset
if it's considered outside the scope of the library (`node-editor` is
intentionally very unopinionated about how editors look or behave).

### Can I call `(dis)connectedCallback()`/`attributeChangedCallback()` manually?

Please don't. These are intended to be called directly by the Web Components system
in browsers and thus expect to actually be called in response to some lifecycle
event. While all internal ("private") methods are hidden away from the public
API using symbols, these callbacks couldn't be. This doesn't mean they should
be called by user code.

### What about `NodeXyzElement.observedAttributes`?

Nothing's stopping you, it has to exist for the web components to work correctly,
and referring to them is guaranteed not to have any side effects.

# License

Copyright &copy; 2022 by [Josh Junon](https://github.com/qix-). Released under the [MIT License](LICENSE).
