/**
 * dsh-music-panel — Web Client half.
 *
 * GENERATED FILE. Edit src/** instead, then run: node scripts/build-client.mjs
 */

window.__ModuleLoader__.load({
  id: 'dsh-music-panel',
  factory: function (require) {
    'use strict'
    var APP_VERSION = "0.32.0"

    // ── src/00-runtime.js
    /**
     * runtime: React bindings, plugin constants.
     *
     * Every other fragment runs in the same factory scope, so these names are
     * shared by all of them; the build script fails on duplicate declarations.
     */

    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef
    var useMemo = React.useMemo
    var useCallback = React.useCallback
    var useLayoutEffect = React.useLayoutEffect || React.useEffect

    var PANEL_ID = 'music'
    var PREFS_EVENT = 'dsh-music:prefs-changed'

    // ── src/02-autoanimate.js
    /**
     * AutoAnimate 0.10.2 (MIT) — vendored for the zero-build client.
     * https://github.com/formkit/auto-animate
     * Copyright 2022 FormKit Inc. See THIRD_PARTY_NOTICES.md.
     *
     * The upstream React adapter is included below as `useAutoAnimate`; only the
     * dependency-free FLIP engine and the official hook logic are kept.
     */
    var autoAnimate = (function () {
        /**
         * A set of all the parents currently being observe. This is the only non weak
         * registry.
         */
        const parents = new Set();
        /**
         * Element coordinates that is constantly kept up to date.
         */
        const coords = new WeakMap();
        /**
         * Siblings of elements that have been removed from the dom.
         */
        const siblings = new WeakMap();
        /**
         * Animations that are currently running.
         */
        const animations = new WeakMap();
        /**
         * A map of existing intersection observers used to track element movements.
         */
        const intersections = new WeakMap();
        /**
         * A map of existing mutation observers used to track element movements.
         */
        const mutationObservers = new WeakMap();
        /**
         * Intervals for automatically checking the position of elements occasionally.
         */
        const intervals = new WeakMap();
        /**
         * The configuration options for each group of elements.
         */
        const options = new WeakMap();
        /**
         * Debounce counters by id, used to debounce calls to update positions.
         */
        const debounces = new WeakMap();
        /**
         * All parents that are currently enabled are tracked here.
         */
        const enabled = new WeakSet();
        /**
         * The document used to calculate transitions.
         */
        let root;
        /**
         * The root’s XY scroll positions.
         */
        let scrollX = 0;
        let scrollY = 0;
        /**
         * Used to sign an element as the target.
         */
        const TGT = "__aa_tgt";
        /**
         * Used to sign an element as being part of a removal.
         */
        const DEL = "__aa_del";
        /**
         * Used to sign an element as being "new". When an element is removed from the
         * dom, but may cycle back in we can sign it with new to ensure the next time
         * it is recognized we consider it new.
         */
        const NEW = "__aa_new";
        /**
         * Callback for handling all mutations.
         * @param mutations - A mutation list
         */
        const handleMutations = (mutations) => {
            const elements = getElements(mutations);
            // If elements is "false" that means this mutation that should be ignored.
            if (elements) {
                elements.forEach((el) => animate(el));
            }
        };
        /**
         *
         * @param entries - Elements that have been resized.
         */
        const handleResizes = (entries) => {
            entries.forEach((entry) => {
                if (entry.target === root)
                    updateAllPos();
                if (coords.has(entry.target))
                    updatePos(entry.target);
            });
        };
        /**
         * Determine if an element is fully outside of the current viewport.
         * @param el - Element to test
         */
        function isOffscreen(el) {
            const rect = el.getBoundingClientRect();
            const vw = (root === null || root === void 0 ? void 0 : root.clientWidth) || 0;
            const vh = (root === null || root === void 0 ? void 0 : root.clientHeight) || 0;
            return rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw;
        }
        /**
         * Observe this elements position.
         * @param el - The element to observe the position of.
         */
        function observePosition(el) {
            const oldObserver = intersections.get(el);
            oldObserver === null || oldObserver === void 0 ? void 0 : oldObserver.disconnect();
            if (!el.isConnected) {
                intersections.delete(el);
                return;
            }
            let rect = coords.get(el);
            let invocations = 0;
            const buffer = 5;
            if (!rect) {
                rect = getCoords(el);
                coords.set(el, rect);
            }
            const { offsetWidth, offsetHeight } = root;
            const rootMargins = [
                rect.top - buffer,
                offsetWidth - (rect.left + buffer + rect.width),
                offsetHeight - (rect.top + buffer + rect.height),
                rect.left - buffer,
            ];
            const rootMargin = rootMargins
                .map((px) => `${ -1 * Math.floor(px)}px`)
                .join(" ");
            const observer = new IntersectionObserver(() => {
                ++invocations > 1 && updatePos(el);
            }, {
                root,
                threshold: 1,
                rootMargin,
            });
            observer.observe(el);
            intersections.set(el, observer);
        }
        /**
         * Update the exact position of a given element.
         * @param el - An element to update the position of.
         * @param debounce - Whether or not to debounce the update. After an animation is finished, it should update as soon as possible to prevent flickering on quick toggles.
         */
        function updatePos(el, debounce = true) {
            clearTimeout(debounces.get(el));
            const optionsOrPlugin = getOptions(el);
            const delay = debounce
                ? isPlugin(optionsOrPlugin)
                    ? 500
                    : optionsOrPlugin.duration
                : 0;
            debounces.set(el, setTimeout(async () => {
                const currentAnimation = animations.get(el);
                try {
                    await (currentAnimation === null || currentAnimation === void 0 ? void 0 : currentAnimation.finished);
                    coords.set(el, getCoords(el));
                    observePosition(el);
                }
                catch {
                    // ignore errors as the `.finished` promise is rejected when animations were cancelled
                }
            }, delay));
        }
        /**
         * Updates all positions that are currently being tracked.
         */
        function updateAllPos() {
            clearTimeout(debounces.get(root));
            debounces.set(root, setTimeout(() => {
                parents.forEach((parent) => forEach(parent, (el) => lowPriority(() => updatePos(el))));
            }, 100));
        }
        /**
         * Its possible for a quick scroll or other fast events to get past the
         * intersection observer, so occasionally we need want "cold-poll" for the
         * latests and greatest position. We try to do this in the most non-disruptive
         * fashion possible. First we only do this ever couple seconds, staggard by a
         * random offset.
         * @param el - Element
         */
        function poll(el) {
            setTimeout(() => {
                intervals.set(el, setInterval(() => lowPriority(updatePos.bind(null, el)), 2000));
            }, Math.round(2000 * Math.random()));
        }
        /**
         * Perform some operation that is non critical at some point.
         * @param callback
         */
        function lowPriority(callback) {
            if (typeof requestIdleCallback === "function") {
                requestIdleCallback(() => callback());
            }
            else {
                requestAnimationFrame(() => callback());
            }
        }
        /**
         * A resize observer, responsible for recalculating elements on resize.
         */
        let resize;
        /**
         * Ensure the browser is supported.
         */
        const supportedBrowser = typeof window !== "undefined" && "ResizeObserver" in window;
        /**
         * If this is in a browser, initialize our Web APIs
         */
        if (supportedBrowser) {
            root = document.documentElement;
            new MutationObserver(handleMutations);
            resize = new ResizeObserver(handleResizes);
            window.addEventListener("scroll", () => {
                scrollY = window.scrollY;
                scrollX = window.scrollX;
            });
            resize.observe(root);
            // A CSS transition/animation on an animated parent (or an ancestor) can move
            // its children without any reflow or resize — e.g. a menu sliding in with
            // `transform`. Re-measure once it ends, so the next change doesn't animate
            // children from where they used to be (formkit/auto-animate#227). These
            // events only fire for CSS transitions/animations, never for our own WAAPI
            // animations.
            document.addEventListener("transitionend", remeasureAfterMove, true);
            document.addEventListener("animationend", remeasureAfterMove, true);
        }
        /**
         * Transitions of these properties only repaint, so they can't move anything.
         */
        const paintOnly = /^(color|background|opacity|box-shadow|text-shadow|outline|filter|backdrop-filter|fill|stroke|border-color|caret-color|text-decoration|visibility)/;
        /**
         * Animated parents waiting to be re-measured after a CSS transition/animation.
         */
        const pendingRemeasure = new Set();
        /**
         * Queue a re-measure of every animated parent that is (or is inside) the
         * element whose CSS transition or animation just ended. Re-measuring is
         * coalesced into one pass per frame, so event storms (e.g. a dark-mode toggle
         * with `* { transition: ... }`) stay cheap.
         * @param e - The transitionend/animationend event.
         */
        function remeasureAfterMove(e) {
            var _a, _b;
            if (e.type === "transitionend" &&
                paintOnly.test(e.propertyName))
                return;
            // composedPath() sees through shadow roots (e.target is retargeted).
            const target = ((_b = (_a = e.composedPath) === null || _a === void 0 ? void 0 : _a.call(e)[0]) !== null && _b !== void 0 ? _b : e.target);
            if (!(target instanceof Element))
                return;
            const wasEmpty = !pendingRemeasure.size;
            parents.forEach((parent) => {
                if (target === parent || target.contains(parent))
                    pendingRemeasure.add(parent);
            });
            if (wasEmpty && pendingRemeasure.size) {
                requestAnimationFrame(() => {
                    const queued = [...pendingRemeasure];
                    pendingRemeasure.clear();
                    queued.forEach((parent) => {
                        if (!parents.has(parent))
                            return;
                        forEach(parent, (el) => {
                            if (coords.has(el))
                                updatePos(el, false);
                        });
                    });
                });
            }
        }
        /**
         * Retrieves all the elements that may have been affected by the last mutation
         * including ones that have been removed and are no longer in the DOM.
         * @param mutations - A mutation list.
         * @returns
         */
        function getElements(mutations) {
            const observedNodes = mutations.reduce((nodes, mutation) => {
                return [
                    ...nodes,
                    ...Array.from(mutation.addedNodes),
                    ...Array.from(mutation.removedNodes),
                ];
            }, []);
            // Short circuit if _only_ comment nodes are observed
            const onlyCommentNodesObserved = observedNodes.every((node) => node.nodeName === "#comment");
            if (onlyCommentNodesObserved)
                return false;
            return mutations.reduce((elements, mutation) => {
                // Short circuit if we find a purposefully deleted node.
                if (elements === false)
                    return false;
                if (mutation.target instanceof Element) {
                    target(mutation.target);
                    if (!elements.has(mutation.target)) {
                        elements.add(mutation.target);
                        for (let i = 0; i < mutation.target.children.length; i++) {
                            const child = mutation.target.children.item(i);
                            if (!child)
                                continue;
                            if (DEL in child) {
                                return false;
                            }
                            target(mutation.target, child);
                            elements.add(child);
                        }
                    }
                    if (mutation.removedNodes.length) {
                        for (let i = 0; i < mutation.removedNodes.length; i++) {
                            const child = mutation.removedNodes[i];
                            if (DEL in child) {
                                return false;
                            }
                            if (child instanceof Element) {
                                elements.add(child);
                                target(mutation.target, child);
                                siblings.set(child, [
                                    mutation.previousSibling,
                                    mutation.nextSibling,
                                ]);
                            }
                        }
                    }
                }
                return elements;
            }, new Set());
        }
        /**
         * Assign the target to an element.
         * @param el - The root element
         * @param child
         */
        function target(el, child) {
            if (!child && !(TGT in el))
                Object.defineProperty(el, TGT, { value: el });
            else if (child && !(TGT in child))
                Object.defineProperty(child, TGT, { value: el });
        }
        /**
         * Determines what kind of change took place on the given element and then
         * performs the proper animation based on that.
         * @param el - The specific element to animate.
         */
        function animate(el) {
            var _a, _b;
            const isMounted = el.isConnected;
            const preExisting = coords.has(el);
            if (isMounted && siblings.has(el))
                siblings.delete(el);
            if (((_a = animations.get(el)) === null || _a === void 0 ? void 0 : _a.playState) !== "finished") {
                (_b = animations.get(el)) === null || _b === void 0 ? void 0 : _b.cancel();
            }
            if (NEW in el) {
                add(el);
            }
            else if (preExisting && isMounted) {
                remain(el);
            }
            else if (preExisting && !isMounted) {
                remove(el);
            }
            else {
                add(el);
            }
        }
        /**
         * Removes all non-digits from a string and casts to a number.
         * @param str - A string containing a pixel value.
         * @returns
         */
        function raw(str) {
            return Number(str.replace(/[^0-9.\-]/g, ""));
        }
        /**
         * Get the scroll offset of elements
         * @param el - Element
         * @returns
         */
        function getScrollOffset(el) {
            let p = el.parentElement;
            while (p) {
                if (p.scrollLeft || p.scrollTop) {
                    return { x: p.scrollLeft, y: p.scrollTop };
                }
                p = p.parentElement;
            }
            return { x: 0, y: 0 };
        }
        /**
         * Get the coordinates of elements adjusted for scroll position.
         * @param el - Element
         * @returns
         */
        function getCoords(el) {
            const rect = el.getBoundingClientRect();
            const { x, y } = getScrollOffset(el);
            return {
                top: rect.top + y,
                left: rect.left + x,
                width: rect.width,
                height: rect.height,
            };
        }
        /**
         * Returns the width/height that the element should be transitioned between.
         * This takes into account box-sizing.
         * @param el - Element being animated
         * @param oldCoords - Old set of Coordinates coordinates
         * @param newCoords - New set of Coordinates coordinates
         * @returns
         */
        function getTransitionSizes(el, oldCoords, newCoords) {
            let widthFrom = oldCoords.width;
            let heightFrom = oldCoords.height;
            let widthTo = newCoords.width;
            let heightTo = newCoords.height;
            const styles = getComputedStyle(el);
            const sizing = styles.getPropertyValue("box-sizing");
            if (sizing === "content-box") {
                const paddingY = raw(styles.paddingTop) +
                    raw(styles.paddingBottom) +
                    raw(styles.borderTopWidth) +
                    raw(styles.borderBottomWidth);
                const paddingX = raw(styles.paddingLeft) +
                    raw(styles.paddingRight) +
                    raw(styles.borderRightWidth) +
                    raw(styles.borderLeftWidth);
                widthFrom -= paddingX;
                widthTo -= paddingX;
                heightFrom -= paddingY;
                heightTo -= paddingY;
            }
            return [widthFrom, widthTo, heightFrom, heightTo].map(Math.round);
        }
        /**
         * Retrieves animation options for the current element.
         * @param el - Element to retrieve options for.
         * @returns
         */
        function getOptions(el) {
            return TGT in el && options.has(el[TGT])
                ? options.get(el[TGT])
                : { duration: 250, easing: "ease-in-out" };
        }
        /**
         * Returns the target of a given animation (generally the parent).
         * @param el - An element to check for a target
         * @returns
         */
        function getTarget(el) {
            if (TGT in el)
                return el[TGT];
            return undefined;
        }
        /**
         * Checks if animations are enabled or disabled for a given element.
         * @param el - Any element
         * @returns
         */
        function isEnabled(el) {
            const target = getTarget(el);
            return target ? enabled.has(target) : false;
        }
        /**
         * Iterate over the children of a given parent.
         * @param parent - A parent element
         * @param callback - A callback
         */
        function forEach(parent, ...callbacks) {
            callbacks.forEach((callback) => callback(parent, options.has(parent)));
            for (let i = 0; i < parent.children.length; i++) {
                const child = parent.children.item(i);
                if (child) {
                    callbacks.forEach((callback) => callback(child, options.has(child)));
                }
            }
        }
        /**
         * Always return tuple to provide consistent interface
         */
        function getPluginTuple(pluginReturn) {
            if (Array.isArray(pluginReturn))
                return pluginReturn;
            return [pluginReturn];
        }
        /**
         * Determine if config is plugin
         */
        function isPlugin(config) {
            return typeof config === "function";
        }
        /**
         * The element in question is remaining in the DOM.
         * @param el - Element to flip
         * @returns
         */
        function remain(el) {
            const oldCoords = coords.get(el);
            const newCoords = getCoords(el);
            if (!isEnabled(el))
                return coords.set(el, newCoords);
            if (isOffscreen(el)) {
                // When element is offscreen, skip FLIP to avoid broken transforms
                coords.set(el, newCoords);
                observePosition(el);
                return;
            }
            let animation;
            if (!oldCoords)
                return;
            const pluginOrOptions = getOptions(el);
            if (typeof pluginOrOptions !== "function") {
                let deltaLeft = oldCoords.left - newCoords.left;
                let deltaTop = oldCoords.top - newCoords.top;
                const deltaRight = oldCoords.left + oldCoords.width - (newCoords.left + newCoords.width);
                const deltaBottom = oldCoords.top + oldCoords.height - (newCoords.top + newCoords.height);
                // element is probably anchored and doesn't need to be offset
                if (deltaBottom == 0)
                    deltaTop = 0;
                if (deltaRight == 0)
                    deltaLeft = 0;
                const [widthFrom, widthTo, heightFrom, heightTo] = getTransitionSizes(el, oldCoords, newCoords);
                const start = {
                    transform: `translate(${deltaLeft}px, ${deltaTop}px)`,
                };
                const end = {
                    transform: `translate(0, 0)`,
                };
                if (widthFrom !== widthTo) {
                    start.width = `${widthFrom}px`;
                    end.width = `${widthTo}px`;
                }
                if (heightFrom !== heightTo) {
                    start.height = `${heightFrom}px`;
                    end.height = `${heightTo}px`;
                }
                animation = el.animate([start, end], {
                    duration: pluginOrOptions.duration,
                    easing: pluginOrOptions.easing,
                });
            }
            else {
                const [keyframes] = getPluginTuple(pluginOrOptions(el, "remain", oldCoords, newCoords));
                animation = new Animation(keyframes);
                animation.play();
            }
            animations.set(el, animation);
            coords.set(el, newCoords);
            animation.addEventListener("finish", updatePos.bind(null, el, false), {
                once: true,
            });
        }
        /**
         * Adds the element with a transition.
         * @param el - Animates the element being added.
         */
        function add(el) {
            if (NEW in el)
                delete el[NEW];
            const newCoords = getCoords(el);
            coords.set(el, newCoords);
            const pluginOrOptions = getOptions(el);
            if (!isEnabled(el))
                return;
            if (isOffscreen(el)) {
                // Skip entry animation if element is not visible in viewport
                observePosition(el);
                return;
            }
            let animation;
            if (typeof pluginOrOptions !== "function") {
                animation = el.animate([
                    { transform: "scale(.98)", opacity: 0 },
                    { transform: "scale(0.98)", opacity: 0, offset: 0.5 },
                    { transform: "scale(1)", opacity: 1 },
                ], {
                    duration: pluginOrOptions.duration * 1.5,
                    easing: "ease-in",
                });
            }
            else {
                const [keyframes] = getPluginTuple(pluginOrOptions(el, "add", newCoords));
                animation = new Animation(keyframes);
                animation.play();
            }
            animations.set(el, animation);
            animation.addEventListener("finish", updatePos.bind(null, el, false), {
                once: true,
            });
        }
        /**
         * Clean up after removing an element from the dom.
         * @param el - Element being removed
         * @param styles - Optional styles that should be removed from the element.
         */
        function cleanUp(el, styles) {
            var _a;
            el.remove();
            coords.delete(el);
            siblings.delete(el);
            animations.delete(el);
            (_a = intersections.get(el)) === null || _a === void 0 ? void 0 : _a.disconnect();
            setTimeout(() => {
                if (DEL in el)
                    delete el[DEL];
                Object.defineProperty(el, NEW, { value: true, configurable: true });
                if (styles && (el instanceof HTMLElement || el instanceof SVGElement)) {
                    for (const style in styles) {
                        el.style[style] = "";
                    }
                }
            }, 0);
        }
        /**
         * Animates the removal of an element.
         * @param el - Element to remove
         */
        function remove(el) {
            var _a;
            if (!siblings.has(el) || !coords.has(el))
                return;
            const [prev, next] = siblings.get(el);
            Object.defineProperty(el, DEL, { value: true, configurable: true });
            const finalX = window.scrollX;
            const finalY = window.scrollY;
            if (next &&
                next.parentNode &&
                next.parentNode instanceof Element) {
                next.parentNode.insertBefore(el, next);
            }
            else if (prev && prev.parentNode) {
                prev.parentNode.appendChild(el);
            }
            else {
                (_a = getTarget(el)) === null || _a === void 0 ? void 0 : _a.appendChild(el);
            }
            if (!isEnabled(el))
                return cleanUp(el);
            const [top, left, width, height] = deletePosition(el);
            const optionsOrPlugin = getOptions(el);
            const oldCoords = coords.get(el);
            if (finalX !== scrollX || finalY !== scrollY) {
                adjustScroll(el, finalX, finalY, optionsOrPlugin);
            }
            let animation;
            let styleReset = {
                position: "absolute",
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                height: `${height}px`,
                margin: "0",
                pointerEvents: "none",
                transformOrigin: "center",
                zIndex: "100",
            };
            if (!isPlugin(optionsOrPlugin)) {
                Object.assign(el.style, styleReset);
                animation = el.animate([
                    {
                        transform: "scale(1)",
                        opacity: 1,
                    },
                    {
                        transform: "scale(.98)",
                        opacity: 0,
                    },
                ], {
                    duration: optionsOrPlugin.duration,
                    easing: "ease-out",
                });
            }
            else {
                const [keyframes, options] = getPluginTuple(optionsOrPlugin(el, "remove", oldCoords));
                if ((options === null || options === void 0 ? void 0 : options.styleReset) !== false) {
                    styleReset =
                        (options === null || options === void 0 ? void 0 : options.styleReset) ||
                            styleReset;
                    Object.assign(el.style, styleReset);
                }
                animation = new Animation(keyframes);
                animation.play();
            }
            animations.set(el, animation);
            animation.addEventListener("finish", () => cleanUp(el, styleReset), {
                once: true,
            });
        }
        /**
         * If the element being removed is at the very bottom of the page, and the
         * the page was scrolled into a space being "made available" by the element
         * that was removed, the page scroll will have jumped up some amount. We need
         * to offset the jump by the amount that the page was "automatically" scrolled
         * up. We can do this by comparing the scroll position before and after the
         * element was removed, and then offsetting by that amount.
         *
         * @param el - The element being deleted
         * @param finalX - The final X scroll position
         * @param finalY - The final Y scroll position
         * @param optionsOrPlugin - The options or plugin
         * @returns
         */
        function adjustScroll(el, finalX, finalY, optionsOrPlugin) {
            const scrollDeltaX = scrollX - finalX;
            const scrollDeltaY = scrollY - finalY;
            const scrollBefore = document.documentElement.style.scrollBehavior;
            const scrollBehavior = getComputedStyle(root).scrollBehavior;
            if (scrollBehavior === "smooth") {
                document.documentElement.style.scrollBehavior = "auto";
            }
            window.scrollTo(window.scrollX + scrollDeltaX, window.scrollY + scrollDeltaY);
            if (!el.parentElement)
                return;
            const parent = el.parentElement;
            let lastHeight = parent.clientHeight;
            let lastWidth = parent.clientWidth;
            const startScroll = performance.now();
            // Here we use a manual scroll animation to keep the element using the same
            // easing and timing as the parent’s scroll animation.
            function smoothScroll() {
                requestAnimationFrame(() => {
                    if (!isPlugin(optionsOrPlugin)) {
                        const deltaY = lastHeight - parent.clientHeight;
                        const deltaX = lastWidth - parent.clientWidth;
                        if (startScroll + optionsOrPlugin.duration >
                            performance.now()) {
                            window.scrollTo({
                                left: window.scrollX - deltaX,
                                top: window.scrollY - deltaY,
                            });
                            lastHeight = parent.clientHeight;
                            lastWidth = parent.clientWidth;
                            smoothScroll();
                        }
                        else {
                            document.documentElement.style.scrollBehavior = scrollBefore;
                        }
                    }
                });
            }
            smoothScroll();
        }
        /**
         * Determines the position of the element being removed.
         * @param el - The element being deleted
         * @returns
         */
        function deletePosition(el) {
            var _a, _b;
            const oldCoords = coords.get(el);
            const [width, , height] = getTransitionSizes(el, oldCoords, getCoords(el));
            let offsetParent = el.parentElement;
            while (offsetParent &&
                (getComputedStyle(offsetParent).position === "static" ||
                    offsetParent instanceof HTMLBodyElement)) {
                offsetParent = offsetParent.parentElement;
            }
            if (!offsetParent)
                offsetParent = document.body;
            const parentStyles = getComputedStyle(offsetParent);
            const parentCoords = !animations.has(el) || ((_a = animations.get(el)) === null || _a === void 0 ? void 0 : _a.playState) === "finished"
                ? getCoords(offsetParent)
                : (_b = coords.get(offsetParent)) !== null && _b !== void 0 ? _b : getCoords(offsetParent);
            const top = Math.round(oldCoords.top - parentCoords.top) -
                raw(parentStyles.borderTopWidth);
            const left = Math.round(oldCoords.left - parentCoords.left) -
                raw(parentStyles.borderLeftWidth);
            return [top, left, width, height];
        }
        /**
         * A function that automatically adds animation effects to itself and its
         * immediate children. Specifically it adds effects for adding, moving, and
         * removing DOM elements.
         * @param el - An HTML or SVG parent element to add animations to.
         * @param options - An optional object of options.
         */
        function autoAnimate(el, config = {}) {
            if (supportedBrowser && resize) {
                const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
                const isDisabledDueToReduceMotion = mediaQuery.matches &&
                    !isPlugin(config) &&
                    !config.disrespectUserMotionPreference;
                if (!isDisabledDueToReduceMotion) {
                    enabled.add(el);
                    if (getComputedStyle(el).position === "static") {
                        Object.assign(el.style, { position: "relative" });
                    }
                    forEach(el, updatePos, poll, (element) => resize === null || resize === void 0 ? void 0 : resize.observe(element));
                    if (isPlugin(config)) {
                        options.set(el, config);
                    }
                    else {
                        options.set(el, {
                            duration: 250,
                            easing: "ease-in-out",
                            ...config,
                        });
                    }
                    if (!mutationObservers.has(el)) {
                        const mo = new MutationObserver(handleMutations);
                        mo.observe(el, { childList: true });
                        mutationObservers.set(el, mo);
                    }
                    parents.add(el);
                }
            }
            const controller = Object.freeze({
                parent: el,
                enable: () => {
                    enabled.add(el);
                },
                disable: () => {
                    enabled.delete(el);
                    // Cancel any in-flight animations and pending timers for immediate effect
                    forEach(el, (node) => {
                        const a = animations.get(node);
                        try {
                            if (DEL in node)
                                a === null || a === void 0 ? void 0 : a.finish();
                            else
                                a === null || a === void 0 ? void 0 : a.cancel();
                        }
                        catch { }
                        animations.delete(node);
                        const d = debounces.get(node);
                        if (d)
                            clearTimeout(d);
                        debounces.delete(node);
                        const i = intervals.get(node);
                        if (i)
                            clearInterval(i);
                        intervals.delete(node);
                    });
                },
                isEnabled: () => enabled.has(el),
                destroy: () => {
                    enabled.delete(el);
                    parents.delete(el);
                    options.delete(el);
                    const mo = mutationObservers.get(el);
                    mo === null || mo === void 0 ? void 0 : mo.disconnect();
                    mutationObservers.delete(el);
                    forEach(el, (node) => {
                        // unobserve resize
                        resize === null || resize === void 0 ? void 0 : resize.unobserve(node);
                        // cancel animations
                        const a = animations.get(node);
                        try {
                            a === null || a === void 0 ? void 0 : a.cancel();
                        }
                        catch { }
                        animations.delete(node);
                        // disconnect observers
                        const io = intersections.get(node);
                        io === null || io === void 0 ? void 0 : io.disconnect();
                        intersections.delete(node);
                        // clear intervals and debounces
                        const i = intervals.get(node);
                        if (i)
                            clearInterval(i);
                        intervals.delete(node);
                        const d = debounces.get(node);
                        if (d)
                            clearTimeout(d);
                        debounces.delete(node);
                        // clear state
                        coords.delete(node);
                        siblings.delete(node);
                    });
                },
            });
            return controller;
        }
        /**
         * The vue directive.
         */
        const vAutoAnimate = {
            mounted: (el, binding) => {
                const ctl = autoAnimate(el, binding.value || {});
                Object.defineProperty(el, "__aa_ctl", { value: ctl, configurable: true });
            },
            unmounted: (el) => {
                var _a;
                const ctl = el["__aa_ctl"];
                (_a = ctl === null || ctl === void 0 ? void 0 : ctl.destroy) === null || _a === void 0 ? void 0 : _a.call(ctl);
                try {
                    delete el["__aa_ctl"];
                }
                catch { }
            },
            getSSRProps: () => ({}),
        };


    return autoAnimate
    })()

    /** Official React adapter, inlined so client.js stays dependency-free. */
    function useAutoAnimate(options) {
      var state = useState(undefined)
      var controller = state[0]
      var setController = state[1]
      var memoizedOptions = useMemo(function () { return options || {} }, [])
      var element = useCallback(function (node) {
        if (node instanceof HTMLElement || node instanceof SVGElement) {
          setController(autoAnimate(node, memoizedOptions))
        } else {
          setController(undefined)
        }
      }, [memoizedOptions])
      var setEnabled = useCallback(function (enabled) {
        if (controller) {
          if (enabled) controller.enable()
          else controller.disable()
        }
      }, [controller])
      useEffect(function () {
        return function () {
          if (controller && typeof controller.destroy === 'function') controller.destroy()
        }
      }, [controller])
      return [element, setEnabled]
    }

    // ── src/00-host-ui.js
    /**
     * Optional host UI kit.
     *
     * DSH exposes its own primitives to plugin bundles. We prefer them so controls
     * look and behave exactly like the host, but the load is best-effort: tests,
     * the harness, or a future DSH without this module fall back to the local
     * primitives (same markup we render today).
     *
     * Rules: docs/theme-guidelines.md.
     */

    var hostUi = null
    try {
      hostUi = require('@deepseek-ai/dsh-client-ui-primitives')
    } catch (error) {
      hostUi = null
    }

    function hostComponent(name) {
      if (!hostUi) return null
      var value = hostUi[name]
      if (typeof value === 'function') return value
      if (value && typeof value === 'object' && value.$$typeof) return value
      return null
    }

    /** Local icon name -> host icon component. Unmapped names keep the local SVG. */
    var HOST_ICON_MAP = {
      search: 'IconSearchOutlineRegular',
      settings: 'IconSettingsOutlineRegular',
      plus: 'IconPlusOutlineRegular',
      trash: 'IconTrashOutlineRegular',
      user: 'IconUserOutlineRegular',
      refresh: 'IconRefreshOutlineRegular',
      play: 'IconPlayOutlineRegular',
      pause: 'IconPauseOutlineRegular',
      info: 'IconInfoOutlineRegular',
      warning: 'IconWarningOutlineRegular',
      download: 'IconDownloadOutlineRegular',
      edit: 'IconEditOutlineRegular',
      copy: 'IconCopyOutlineRegular',
      clock: 'IconClockOutlineRegular',
      folder: 'IconFolderOpenOutlineRegular',
      check: 'IconCheckOutlineRegular',
      checkCircle: 'IconCheckCircleOutlineRegular',
      x: 'IconCloseOutlineRegular',
      more: 'IconEllipsisOutlineRegular',
      chevronDown: 'IconChevronDownOutlineRegular',
      chevronLeft: 'IconChevronLeftOutlineRegular',
      chevronRight: 'IconChevronRightOutlineRegular',
      chevronUp: 'IconChevronUpOutlineRegular',
      sort: 'IconChevronsUpDownOutlineRegular',
      list: 'IconQueueOutlineRegular',
    }

    // ── src/05-i18n.js
    /**
     * locale dictionaries, language detection and t().
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */

    var DICTS = {
      zh: {
        'nav.label': '音乐',
        'guide.title': '把音乐，放在对话旁边。',
        'guide.tagline': '本地与在线音乐，安静地待在对话旁边',
        'guide.lead': '本地曲库与在线平台，一键进入沉浸播放页；歌词跟着你的输入走。',
        'guide.featureLocalTitle': '本地 + 在线',
        'guide.featureLocalDesc': '本地曲库，网易云 / QQ / 酷狗 / 酷狗概念版',
        'guide.featurePlayerTitle': '沉浸播放页',
        'guide.featurePlayerDesc': '方形 / 黑胶封面、全屏、歌词排版与封面取色波图',
        'guide.featureComposerTitle': '输入框歌词',
        'guide.featureComposerDesc': '在输入框上方跟随当前歌词与翻译',
        'guide.featureLibraryTitle': '歌单与喜欢',
        'guide.featureLibraryDesc': '云端歌单、喜欢、缓存和音量均衡',
        'guide.warningTitle': '从旧版本更新？',
        'guide.warningText': '请务必退出账号登录，彻底关闭 DeepSeek Harness，再启动后重新登录；否则在线账号和歌单可能异常。全新安装可忽略。',
        'guide.dontShow': '不再显示',
        'guide.wait': '请稍候 {seconds}s',
        'guide.start': '开始使用',
        'guide.signature': '为对话而生',
        'guide.styleTitle': '播放页封面',
        'guide.styleHint': '选一个你喜欢的样式',
        'guide.styleSquare': '方形',
        'guide.styleVinyl': '黑胶',
        'guide.composerSample': '这一刻，歌词就在输入框上方',
        'guide.chipPlaylists': '歌单',
        'guide.chipLikes': '喜欢',
        'guide.chipCache': '缓存',
        'page.title': '歌曲',
        'page.refresh': '重新扫描',
        'page.scanning': '扫描中…',
        'page.loadFailed': '加载失败',
        'page.retry': '重试',
        'page.emptyTitle': '还没有音乐',
        'page.emptyHint': '在 设置 → 音乐 里添加音乐文件夹，然后回到这里刷新。',
        'page.emptyFolder': '这些文件夹里没有找到音频文件',
        'page.search': '搜索',
        'page.searchPlaceholder': '搜索歌曲、歌手或专辑',
        'page.sort': '排序',
        'page.sortAsc': '升序',
        'page.sortDesc': '降序',
        'page.settings': '设置',
        'page.listSize': '列表大小',
        'page.moreSettings': '音乐目录等更多设置见「设置 → 音乐」。',
        'page.select': '多选',
        'page.selectAll': '全选',
        'page.selectNone': '取消全选',
        'page.playSelected': '播放选中',
        'page.done': '完成',
        'page.clear': '清空列表',
        'page.loopAll': '列表循环',
        'page.modeSequence': '顺序播放',
        'page.modeRandom': '随机播放',
        'page.modeOne': '单曲循环',
        'page.loopOne': '单曲循环',
        'page.loopNone': '不循环',
        'page.shuffle': '随机播放',
        'page.play': '播放',
        'page.pause': '暂停',
        'page.prev': '上一首',
        'page.next': '下一首',
        'page.queue': '播放队列',
        'page.locateCurrent': '定位到当前播放',
        'page.clearQueue': '清空队列',
        'page.moveUp': '上移',
        'page.moveDown': '下移',
        'page.dragSort': '拖动排序',
        'page.more': '更多',
        'editor.title': '编辑播放页',
        'editor.subtitle': '改动即时生效',
        'editor.cover': '封面样式',
        'editor.type': '歌词排版',
        'editor.display': '显示选项',
        'editor.wave': '进度条波图',
        'editor.reset': '恢复默认',
        'editor.resetConfirm': '恢复默认设置？',
        'editor.resetHint': '封面样式、歌词排版和显示选项都会恢复。',
        'editor.cancel': '取消',
        'editor.done': '完成',
        'editor.close': '关闭',
        'page.copyPath': '复制文件路径',
        'page.copied': '已复制',
        'page.volume': '音量',
        'page.mute': '静音',
        'page.sortTitle': '标题',
        'page.sortArtist': '歌手',
        'page.sortAlbum': '专辑',
        'page.sortDuration': '时长',
        'page.sortName': '文件名',
        'page.sortSize': '大小',
        'page.sortYear': '年份',
        'page.sortFolder': '文件夹',
        'page.sortPlays': '播放次数',
        'page.sortMtime': '修改时间',
        'page.sortAdded': '添加时间',
        'page.asc': '升序',
        'page.desc': '降序',
        'page.unknownArtist': '未知歌手',
        'page.warnings': '部分文件夹无法读取',
        'page.truncated': '曲库超过 5000 首，当前只显示前 5000 首',
        'page.queueEmpty': '队列是空的',
        'page.noTrack': '未在播放',
        'page.format': '格式',
        'page.bitrate': '码率',
        'page.sampleRate': '采样率',
        'page.artist': '歌手',
        'page.album': '专辑',
        'page.duration': '时长',
        'page.size': '文件大小',
        'page.plays': '播放次数',
        'page.none': '—',
        'page.selectedCount': '已选 {n} 首',
        'page.noResults': '没有匹配的歌曲',
        'page.skipError': '音频加载失败，已跳到下一首',
        'page.audioError': '音频加载失败',
        'page.openPlayer': '打开播放页',
        'page.closePlayer': '收起播放页',
        'page.fullscreen': '全屏',
        'page.exitFullscreen': '退出全屏',
        'page.fullscreenFailed': '当前环境无法进入全屏',
        'page.noLyrics': '暂无歌词',
        'page.translation': '显示 / 隐藏翻译',
        'page.lyricOffset': '歌词偏移',
        'page.writeLyrics': '写回文件',
        'page.otherTabPlaying': '另一个标签页正在播放',
        'page.lyricOffsetHint': '仅 MP3 / FLAC 支持写回内嵌歌词；其他格式只保存偏移。',
        'page.lyricSize': '字体大小',
        'page.lyricGap': '歌词间距',
        'page.lyricBlur': '模糊非当前歌词',
        'page.translationScale': '翻译字体缩放',
        'stats.rangeWeek': '最近一周',
        'stats.modeRanking': '收听排行',
        'stats.modeRecent': '最近播放',
        'stats.rangeMonth': '最近一月',
        'stats.rangeAll': '全部时间',
        'stats.sortTime': '按时长',
        'stats.sortPlays': '按次数',
        'stats.sortRecent': '按最近',
        'stats.totalTime': '累计播放时长',
        'stats.totalPlays': '总播放次数',
        'stats.trackCount': '有记录曲目',
        'stats.plays': '{n} 次',
        'stats.empty': '还没有播放记录',
        'stats.loading': '加载中…',
        'stats.loadFailed': '统计加载失败',
        'stats.retry': '重试',
        'stats.unavailable': '文件已不可用',
        'page.tabSongs': '本地歌曲',
        'page.tabLocal': '本地音乐',
        'page.tabFavorites': '我喜欢',
        'page.favorite': '喜欢',
        'page.unfavorite': '取消喜欢',
        'page.favoritesEmpty': '还没有收藏',
        'page.favoritesHint': '点歌曲右侧的爱心加入喜欢。',
        'settings.tabOnline': '在线',
        'online.settingsHint': '登录后可播放高音质与更多曲目；未登录只能播放免费曲目。Cookie 只保存在本机。',
        'online.loggedCount': '已登录 {n} / {total}',
        'online.accountHint': '登录后可播放高音质与更多曲目',
        'online.loggedIn': '已登录',
        'online.loggedOut': '未登录',
        'online.login': '登录',
        'online.loginWechat': '微信登录',
        'online.loginQq': 'QQ 登录',
        'online.logout': '退出',
        'online.loginHint': '扫码登录：用对应 App 扫描弹出的二维码并确认，登录状态保存在本机。',
        'online.qrDesc': '打开 {provider} App，扫描二维码完成登录',
        'online.scanLogin': '扫码登录',
        'online.qrLoading': '正在生成二维码…',
        'online.qrStep1': '打开手机上的对应 App',
        'online.qrStep2': '扫一扫，并在手机上确认',
        'online.qrSecure': '登录信息仅保存在本机',
        'online.qrRefresh': '刷新二维码',
        'online.loginTitle': '登录 {provider}',
        'online.statuswaiting': '等待扫码',
        'online.statusscanned': '已扫码，请在 App 中确认',
        'online.statussuccess': '登录成功',
        'online.statusexpired': '二维码已过期，请重新登录',
        'online.statusfailed': '登录失败',
        'online.loginSuccess': '登录成功',
        'online.logoutDone': '已退出登录',
        'online.providerNetease': '网易云',
        'online.providerQq': 'QQ 音乐',
        'online.providerKugou': '酷狗',
        'online.providerKugouLite': '酷狗概念版',
        'online.providerNavidrome': 'Navidrome',
        'online.navidromeServer': '服务器地址',
        'online.navidromeServerPlaceholder': 'https://music.example.com:4533',
        'online.navidromeUser': '用户名',
        'online.navidromePassword': '密码',
        'online.navidromeConnect': '连接',
        'online.navidromeTitle': '连接 Navidrome / Subsonic',
        'online.navidromeSave': '保存并连接',
        'online.navidromeNeedUser': '请填写用户名',
        'online.navidromeNeedPassword': '请填写密码',
        'online.navidromeConnecting': '连接中…',
        'online.navidromeHint': '填写自建 Navidrome / Subsonic 服务器的地址与账号。密码仅用于换取访问令牌，不会保存在本机。',
        'online.navidromeBadServer': '请填写有效的 http(s) 服务器地址',
        'online.navidromeOk': '已连接：{version}',
        'online.allSongsEmpty': '曲库为空',
        'online.allSongsEmptyHint': '服务器上没有可播放的歌曲',
        'online.albumCount': '{n} 张专辑',
        'online.navidromeKeep': '保存密码，启用完整曲库',
        'online.navidromeKeepWarn': '密码将以明文保存在本机 providers.json（权限 0600）。原生接口是 Navidrome 的内部接口，可能随版本变化。',
        'online.pageOf': '第 {page} / {pages} 页 · 共 {total} 首',
        'online.randomSample': '当前为随机采样（{n} 首），不是完整曲库',
        'online.enableFullLibrary': '启用完整曲库',
        'online.searchPlaceholder': '搜索在线音乐…',
        'online.searching': '搜索中…',
        'online.hint': '选择平台并搜索。未登录可播放免费曲目；登录后可用高音质（设置 → 在线音乐）。',
        'online.vip': 'VIP',
        'online.recent': '最近播放',
        'online.myPlaylists': '我的歌单',
        'online.viewAll': '查看全部',
        'online.searchResults': '搜索结果',
        'online.loadMore': '加载更多',
        'online.loadingMore': '加载中…',
        'online.emptyResults': '没有找到歌曲',
        'online.locatePlaying': '定位到正在播放',
        'online.noPlaying': '当前没有正在播放的歌曲',
        'online.clearUnplayable': '清除无法播放的歌曲',
        'online.clearedUnplayable': '已移除 {n} 首无法播放的歌曲',
        'online.removeFromHistory': '从最近播放中移除',
        'online.removedFromHistory': '已从最近播放中移除',
        'online.vipOnly': 'VIP / 付费曲目无法播放（需要会员）',
        'online.vipSkipped': '已跳过 {n} 首 VIP 曲目（当前账号无会员）',
        'online.album': '专辑',
        'online.albumFailed': '专辑曲目获取失败',
        'online.quality': '音质',
        'online.qualityStandard': '标准',
        'online.qualityHigh': '高音质',
        'online.qualityLossless': '无损',
        'online.qualitySaved': '音质设置已保存',
        'online.cache': '缓存',
        'online.cacheSize': '缓存占用 {n} · {files} 个文件',
      'online.cacheListHint': '列表只显示有音频缓存的歌曲；封面、歌词和元数据也计入文件数与占用。',
        'online.refresh': '刷新',
        'online.clearCache': '清空缓存',
        'online.cacheCleared': '缓存已清空',
        'online.cached': '已缓存',
        'online.cacheProgress': '缓存中 {pct}%',
        'online.cacheList': '缓存列表',
        'online.cacheEmpty': '还没有缓存的歌曲',
        'online.removeCache': '删除缓存',
        'online.cacheRemoved': '已删除该缓存',
        'online.hasLyric': '含歌词',
        'online.networkError': '网络请求失败，请检查网络后重试',
        'online.loginExpired': '登录已过期，请重新登录（设置 → 在线）',
        'online.authExpired': '登录已失效',
        'online.authExpiredHint': '当前平台的登录态已失效，请重新登录后查看歌单。',
        'online.relogin': '重新登录',
        'online.retry': '重试',
        'online.playlistsError': '歌单加载失败',
        'online.playFailed': '在线播放失败，已自动跳过',
        'online.online': '在线',
        'online.modeSearch': '搜索',
        'online.modePlaylists': '我的歌单',
        'online.back': '返回',
        'online.playlistsHint': '登录后可在这里查看「我的歌单」；请先在 设置 → 在线 扫码登录。',
        'page.tabStats': '统计',
        'page.tabAlbums': '专辑',
        'page.tabArtists': '艺术家',
        'page.tabFolders': '文件夹',
        'page.folder': '文件夹',
        'page.folderEmpty': '没有找到文件夹',
        'page.unknownAlbum': '未知专辑',
        'page.clearFilter': '清除',
        'page.trackCountUnit': '{n} 首',
        'page.tabPlaylists': '播放列表',
        'page.newPlaylist': '新建播放列表',
        'page.playlistName': '播放列表名称',
        'page.create': '创建',
        'page.delete': '删除',
        'page.cancel': '取消',
        'page.deleteConfirm': '删除「{name}」？此操作不可撤销。',
        'page.back': '返回',
        'page.playAll': '播放全部',
        'page.playbackFailed': '无法播放：{reason}',
        'page.playbackFailedNoReason': '无法播放，已跳到下一首',
        'page.addTo': '添加到歌单',
        'page.addToPlaylist': '添加到播放列表',
        'page.addedToPlaylist': '已添加到播放列表',
        'page.addedNext': '已插入下一首',
        'page.reveal': '在文件夹中显示',
        'page.revealed': '已在文件夹中打开',
        'page.favoriteSelected': '喜欢选中',
        'page.batchEdit': '批量编辑',
        'page.batchHint': '将修改选中的 {n} 首歌曲，留空的字段保持不变',
        'page.batchSaved': '已更新 {n} 首',
        'page.batchEmpty': '没有要修改的字段',
        'page.keepEmpty': '留空则不修改',
        'page.duplicates': '重复 {n} 组',
        'page.duplicatesTitle': '重复歌曲',
        'page.duplicatesHint': '标题、艺术家与时长相同，可能是重复文件',
        'page.deleteDuplicates': '删除重复（保留音质最好的）',
        'page.deleteDuplicatesConfirm': '按码率 → 采样率 → 文件大小保留最好的一首，把其余 {n} 个移到插件回收站（可恢复），继续？',
        'page.duplicatesRemoved': '已移除 {n} 个文件',
        'page.onlineLyrics': '在线歌词',
        'page.onlineLyricsAction': '搜索',
        'page.lyricsSearch': '搜索',
        'page.lyricsSearchPlaceholder': '歌名',
        'page.lyricsNoResults': '没有找到歌词',
        'page.lyricsLineCount': '{n} 行',
        'page.lyricsBack': '返回结果',
        'page.lyricsPreviewHint': '选择一首歌查看歌词',
        'page.lyricsSave': '保存为 .lrc',
        'page.lyricsApply': '应用',
        'page.lyricsSaved': '歌词已写入文件内嵌',
        'settings.sleepTimer': '睡眠定时',
        'settings.sleepOff': '关闭',
        'settings.sleepTimerDone': '睡眠定时已到，已暂停播放',
        'sleep.remaining': '剩余 {time}',
        'sleep.hint': '到点后自动暂停播放',
        'sleep.presets': '常用时长',
        'sleep.custom': '自定义',
        'sleep.minutes': '分钟',
        'sleep.set': '设置',
        'sleep.placeholder': '输入分钟数',
        'sleep.invalid': '请输入 1–720 分钟',
        'onboarding.title': '欢迎使用音乐插件',
        'onboarding.skip': '跳过',
        'onboarding.back': '上一步',
        'onboarding.next': '下一步',
        'onboarding.start': '开始使用',
        'onboarding.pickFolder': '选择文件夹',
        'onboarding.reopen': '查看使用引导',
        'onboarding.step1Icon': '📂',
        'onboarding.step1Title': '添加你的音乐文件夹',
        'onboarding.step1Text': '在空曲库页面点「添加文件夹」，选择你的音乐目录。插件会扫描歌曲、封面和标签，全程在你本机完成。',
        'onboarding.step2Icon': '▶️',
        'onboarding.step2Title': '双击播放',
        'onboarding.step2Text': '双击任意歌曲开始播放；底栏可以切歌、打开队列、切换随机。空格暂停 / 继续，Ctrl/⌘ + ←/→ 切歌。',
        'onboarding.step3Icon': '🎧',
        'onboarding.step3Title': '让曲库更完整',
        'onboarding.step3Text': '右键歌曲可编辑元数据、在线匹配封面与标签、搜索在线歌词；播放页「Aa」调整歌词样式，设置页管理外观与播放行为。',
        'page.details': '详细信息',
        'page.noPlaylists': '还没有歌单',
        'page.newPlaylistAdd': '新建歌单并添加',
        'page.editMeta': '编辑元数据',
        'page.metaTitle': '标题',
        'page.year': '年份',
        'page.trackNo': '音轨号',
        'page.discNo': '碟号',
        'page.genre': '风格',
        'page.albumArtist': '专辑艺术家',
        'page.composer': '作曲',
        'page.lyricist': '作词',
        'page.comment': '注释',
        'page.lyrics': '歌词',
        'page.lyricsPlaceholder': '支持 LRC 时间戳，可直接粘贴或在线搜索',
        'page.save': '保存',
        'page.saving': '保存中…',
        'page.metaSaved': '元数据已保存',
        'page.metaHint': '修改会直接写入音频文件标签（FLAC / MP3）；封面与未编辑的标签会保留。',
        'page.metaBasic': '基本信息',
        'page.metaDetail': '制作信息',
        'page.onlineMatch': '在线匹配',
        'page.onlineHint': '在线匹配使用网易云 / QQ 音乐（非官方接口）与 iTunes / MusicBrainz；结果可能不完整或随时失效。',
        'page.onlineLoading': '在线搜索中…',
        'page.onlineEmpty': '没有找到匹配结果',
        'page.onlineResults': '在线搜索结果',
        'page.sourceNetease': '网易云',
        'page.sourceQq': 'QQ 音乐',
        'page.sourceItunes': 'iTunes',
        'page.sourceMusicbrainz': 'MusicBrainz',
        'page.results': '个结果',
        'page.replaceCover': '更换封面',
        'page.resetCover': '恢复原封面',
        'page.coverPending': '已选择在线封面，保存后写入',
        'page.matchField': '搜索替换',
        'page.listView': '列表视图',
        'page.addedCount': '已添加 {n} 首',
        'page.trackCount': '{n} 首',
        'page.removeTrack': '从歌单移除',
        'page.playlistEmpty': '还没有播放列表',
        'page.playlistEmptyHint': '点顶部的 + 新建一个播放列表。',
        'page.playlistNoTracks': '这个播放列表还没有歌曲',
        'page.playlistNoTracksHint': '到「歌曲」里多选，再添加到播放列表。',
        'page.rename': '保存',
        'settings.label': '音乐',
        'settings.title': '音乐文件夹',
        'settings.hint': '添加包含音频文件的文件夹，支持 mp3 / flac / m4a / wav / ogg / opus / aac。',
        'settings.roots': '文件夹',
        'settings.add': '添加文件夹',
        'settings.remove': '删除',
        'settings.placeholder': '例如 D:\\Music 或 ~/Music',
        'settings.depth': '子文件夹深度',
        'settings.depthHint': '0 表示只扫描所选文件夹本身，默认 4 层。',
        'settings.save': '保存',
        'settings.saving': '保存中…',
        'settings.saved': '已保存',
        'settings.failed': '保存失败',
        'settings.badRoot': '这些目录不可用：',
        'settings.empty': '还没有添加文件夹。',
        'settings.note': '设置保存在本机 DSH 目录下的 music/settings.json。',
        'settings.tabAppearance': '外观',
        'settings.tabLyrics': '歌词',
        'settings.tabLibrary': '音乐库',
        'settings.tabPlayback': '播放',
        'settings.resumeOnStart': '启动时恢复上次播放',
        'settings.autoResume': '恢复后自动播放',
        'settings.rememberPerTrack': '每首歌记住播放位置',
        'settings.playbackHint': '播放次数按 Last.fm 规则记录：曲目超过 30 秒，且播放到一半或 4 分钟（先到为准）才算一次；播放时长只累计真正在播放的时间。',
        'settings.libraryHint': '音乐文件夹（自动保存）',
        'settings.foldersTitle': '音乐文件夹',
        'settings.scannedTracks': '已扫描 {n} 首',
        'settings.scanSettings': '扫描设置',
        'settings.openTrash': '打开',
        'settings.formatsHint': '支持 MP3 / FLAC / M4A / AAC / OGG / OPUS / WAV / AIFF / WMA / APE',
        'settings.scanWarnings': '{n} 条扫描警告',
        'settings.removeConfirm': '确定移除这个音乐文件夹？不会删除文件。',
        'settings.up': '↑ 上级',
        'settings.chooseFolder': '选择此文件夹',
        'settings.pickEmpty': '没有选中文件夹。',
        'settings.pickFailed': '无法读取文件夹路径，请重试或手动填写。',
        'settings.miniPlayer': '迷你浮窗',
        'settings.composerQueueButton': '输入框播放列表按钮',
        'settings.circularCover': '播放页圆形封面',
        'v2.coverStyle': '播放页封面样式',
        'v2.coverStyleDesc': '方形适合查看完整封面，黑胶适合模拟唱片',
        'v2.coverSquare': '方形封面',
        'v2.coverVinyl': '黑胶封面',
        'settings.vinylRing': '圆形封面黑胶底盘',
        'settings.coverSpin': '圆形封面旋转',
        'settings.lyricOrder': '歌词获取顺序',
        'settings.lyricSourceEmbedded': '内嵌歌词',
        'settings.lyricSourceLrc': 'LRC 文件',
        'settings.lyricAlign': '歌词对齐方式',
        'settings.alignCenter': '居中',
        'settings.alignLeft': '左对齐',
        'settings.alignRight': '右对齐',
        'settings.lyricSize': '歌词字体大小',
        'settings.lyricBlur': '模糊非当前歌词',
        'settings.lyricTranslation': '歌词翻译',
        'settings.translationScale': '翻译字体缩放',
        'settings.composerLyrics': '输入框歌词',
        'settings.composerTranslation': '输入框歌词翻译',
        'settings.composerTranslationDesc': '关闭后输入框上方只显示原文',
        'settings.composerLyricPlace': '输入框歌词位置',
        'settings.placeInputLeft': '输入框内（播放列表按钮左侧）',
        'settings.placeAbove': '输入框上方',
      },
      en: {
        'nav.label': 'Music',
        'guide.title': 'Music, right beside the conversation.',
        'guide.tagline': 'Local and online music, right beside your conversation',
        'guide.lead': 'Local library and online platforms, an immersive player, and lyrics that follow your writing.',
        'guide.featureLocalTitle': 'Local + online',
        'guide.featureLocalDesc': 'Local library plus NetEase, QQ Music, KuGou and KuGou Lite',
        'guide.featurePlayerTitle': 'Immersive player',
        'guide.featurePlayerDesc': 'Square or vinyl artwork, fullscreen, lyric layout and cover-coloured waveform',
        'guide.featureComposerTitle': 'Composer lyrics',
        'guide.featureComposerDesc': 'Current lyric and translation above the composer',
        'guide.featureLibraryTitle': 'Playlists & likes',
        'guide.featureLibraryDesc': 'Cloud playlists, likes, caching and loudness leveling',
        'guide.warningTitle': 'Updating from an older version?',
        'guide.warningText': 'Sign out of your account, quit DeepSeek Harness completely, then start it again and sign in. Online accounts and playlists may misbehave otherwise. Fresh installs can ignore this.',
        'guide.dontShow': "Don't show again",
        'guide.wait': 'Please wait {seconds}s',
        'guide.start': 'Start',
        'guide.signature': 'Made for conversation',
        'guide.styleTitle': 'Player artwork',
        'guide.styleHint': 'Pick a look you like',
        'guide.styleSquare': 'Square',
        'guide.styleVinyl': 'Vinyl',
        'guide.composerSample': 'This lyric sits above the composer',
        'guide.chipPlaylists': 'Playlists',
        'guide.chipLikes': 'Likes',
        'guide.chipCache': 'Cache',
        'page.title': 'Songs',
        'page.refresh': 'Rescan',
        'page.scanning': 'Scanning…',
        'page.loadFailed': 'Failed to load',
        'page.retry': 'Retry',
        'page.emptyTitle': 'No music yet',
        'page.emptyHint': 'Add a music folder in Settings → Music, then come back and refresh.',
        'page.emptyFolder': 'No audio files found in those folders',
        'page.search': 'Search',
        'page.searchPlaceholder': 'Search title, artist or album',
        'page.sort': 'Sort',
        'page.sortAsc': 'Ascending',
        'page.sortDesc': 'Descending',
        'page.settings': 'Settings',
        'page.listSize': 'List size',
        'page.moreSettings': 'Folders and more: Settings → Music.',
        'page.select': 'Select',
        'page.selectAll': 'Select all',
        'page.selectNone': 'Clear selection',
        'page.playSelected': 'Play selected',
        'page.done': 'Done',
        'page.clear': 'Clear list',
        'page.loopAll': 'Repeat all',
        'page.modeSequence': 'Play in order',
        'page.modeRandom': 'Shuffle',
        'page.modeOne': 'Repeat one',
        'page.loopOne': 'Repeat one',
        'page.loopNone': 'No repeat',
        'page.shuffle': 'Shuffle',
        'page.play': 'Play',
        'page.pause': 'Pause',
        'page.prev': 'Previous',
        'page.next': 'Next',
        'page.queue': 'Queue',
        'page.locateCurrent': 'Locate current track',
        'page.clearQueue': 'Clear queue',
        'page.moveUp': 'Move up',
        'page.moveDown': 'Move down',
        'page.dragSort': 'Drag to reorder',
        'page.more': 'More',
        'editor.title': 'Edit Now Playing',
        'editor.subtitle': 'Changes apply instantly',
        'editor.cover': 'Cover style',
        'editor.type': 'Lyric typography',
        'editor.display': 'Display',
        'editor.wave': 'Waveform on progress',
        'editor.reset': 'Restore defaults',
        'editor.resetConfirm': 'Restore default settings?',
        'editor.resetHint': 'Cover style, lyric typography and display options will be reset.',
        'editor.cancel': 'Cancel',
        'editor.done': 'Done',
        'editor.close': 'Close',
        'page.copyPath': 'Copy file path',
        'page.copied': 'Copied',
        'page.volume': 'Volume',
        'page.mute': 'Mute',
        'page.sortTitle': 'Title',
        'page.sortArtist': 'Artist',
        'page.sortAlbum': 'Album',
        'page.sortDuration': 'Duration',
        'page.sortName': 'File name',
        'page.sortSize': 'Size',
        'page.sortYear': 'Year',
        'page.sortFolder': 'Folder',
        'page.sortPlays': 'Play count',
        'page.sortMtime': 'Modified',
        'page.sortAdded': 'Date added',
        'page.asc': 'Ascending',
        'page.desc': 'Descending',
        'page.unknownArtist': 'Unknown artist',
        'page.warnings': 'Some folders could not be read',
        'page.truncated': 'Library has more than 5000 tracks; showing the first 5000',
        'page.queueEmpty': 'The queue is empty',
        'page.noTrack': 'Nothing playing',
        'page.format': 'Format',
        'page.bitrate': 'Bitrate',
        'page.sampleRate': 'Sample rate',
        'page.artist': 'Artist',
        'page.album': 'Album',
        'page.duration': 'Duration',
        'page.size': 'File size',
        'page.plays': 'Plays',
        'page.none': '—',
        'page.selectedCount': '{n} selected',
        'page.noResults': 'No matching songs',
        'page.skipError': 'Audio failed to load; skipped to the next track',
        'page.audioError': 'Audio failed to load',
        'page.openPlayer': 'Open player',
        'page.closePlayer': 'Close player',
        'page.fullscreen': 'Fullscreen',
        'page.exitFullscreen': 'Exit fullscreen',
        'page.fullscreenFailed': 'Fullscreen is not available here',
        'page.noLyrics': 'No lyrics',
        'page.translation': 'Show / hide translation',
        'page.lyricOffset': 'Lyric offset',
        'page.writeLyrics': 'Write to file',
        'page.otherTabPlaying': 'Playing in another tab',
        'page.lyricOffsetHint': 'Writing back works for MP3 / FLAC only; other formats keep the offset in settings.',
        'page.lyricSize': 'Font size',
        'page.lyricGap': 'Line spacing',
        'page.lyricBlur': 'Blur inactive lines',
        'page.translationScale': 'Translation scale',
        'stats.rangeWeek': 'Last week',
        'stats.modeRanking': 'Ranking',
        'stats.modeRecent': 'Recently played',
        'stats.rangeMonth': 'Last month',
        'stats.rangeAll': 'All time',
        'stats.sortTime': 'By time',
        'stats.sortPlays': 'By plays',
        'stats.sortRecent': 'By recent',
        'stats.totalTime': 'Listening time',
        'stats.totalPlays': 'Total plays',
        'stats.trackCount': 'Tracks',
        'stats.plays': '{n} plays',
        'stats.empty': 'No listening history yet',
        'stats.loading': 'Loading…',
        'stats.loadFailed': 'Failed to load statistics',
        'stats.retry': 'Retry',
        'stats.unavailable': 'File unavailable',
        'page.tabSongs': 'Local songs',
        'page.tabLocal': 'Local',
        'page.tabFavorites': 'Liked',
        'page.favorite': 'Like',
        'page.unfavorite': 'Unlike',
        'page.favoritesEmpty': 'No liked songs yet',
        'page.favoritesHint': 'Tap the heart next to a song to add it here.',
        'settings.tabOnline': 'Online',
        'online.settingsHint': 'Sign in for higher quality and more tracks; free tracks play without an account. Cookies stay on this machine.',
        'online.loggedCount': '{n} of {total} signed in',
        'online.accountHint': 'Sign in for higher quality and more tracks',
        'online.loggedIn': 'Signed in',
        'online.loggedOut': 'Signed out',
        'online.login': 'Sign in',
        'online.loginWechat': 'WeChat sign-in',
        'online.loginQq': 'QQ sign-in',
        'online.logout': 'Sign out',
        'online.loginHint': 'Scan the QR code with the matching app, then confirm in the app. The login stays on this machine.',
        'online.qrDesc': 'Open {provider} and scan the QR code to sign in',
        'online.scanLogin': 'Scan to sign in',
        'online.qrLoading': 'Generating QR code…',
        'online.qrStep1': 'Open the matching app on your phone',
        'online.qrStep2': 'Scan the code and confirm',
        'online.qrSecure': 'Credentials stay on this device',
        'online.qrRefresh': 'Refresh QR code',
        'online.loginTitle': 'Sign in to {provider}',
        'online.statuswaiting': 'Waiting for scan',
        'online.statusscanned': 'Scanned — confirm in the app',
        'online.statussuccess': 'Signed in',
        'online.statusexpired': 'QR expired — try again',
        'online.statusfailed': 'Sign-in failed',
        'online.loginSuccess': 'Signed in',
        'online.logoutDone': 'Signed out',
        'online.providerNetease': 'NetEase',
        'online.providerQq': 'QQ Music',
        'online.providerKugou': 'KuGou',
        'online.providerKugouLite': 'KuGou Concept',
        'online.providerNavidrome': 'Navidrome',
        'online.navidromeServer': 'Server URL',
        'online.navidromeServerPlaceholder': 'https://music.example.com:4533',
        'online.navidromeUser': 'Username',
        'online.navidromePassword': 'Password',
        'online.navidromeConnect': 'Connect',
        'online.navidromeTitle': 'Connect Navidrome / Subsonic',
        'online.navidromeSave': 'Save and connect',
        'online.navidromeNeedUser': 'Enter a username',
        'online.navidromeNeedPassword': 'Enter a password',
        'online.navidromeConnecting': 'Connecting…',
        'online.navidromeHint': 'Enter the URL and account of your self-hosted Navidrome / Subsonic server. The password is only used to derive an access token and is never stored.',
        'online.navidromeBadServer': 'Enter a valid http(s) server URL',
        'online.navidromeOk': 'Connected: {version}',
        'online.allSongsEmpty': 'Library is empty',
        'online.allSongsEmptyHint': 'The server has no playable songs',
        'online.albumCount': '{n} albums',
        'online.navidromeKeep': 'Save the password to enable the full library',
        'online.navidromeKeepWarn': 'The password is stored as plain text in the local providers.json (mode 0600). The native API is Navidrome-internal and may change between releases.',
        'online.pageOf': 'Page {page} of {pages} · {total} tracks',
        'online.randomSample': 'Showing a random sample of {n} tracks, not the whole library',
        'online.enableFullLibrary': 'Enable full library',
        'online.searchPlaceholder': 'Search online music…',
        'online.searching': 'Searching…',
        'online.hint': 'Pick a provider and search. Free tracks play without signing in; sign in (Settings → Online) for higher quality.',
        'online.vip': 'VIP',
        'online.recent': 'Recently played',
        'online.myPlaylists': 'My playlists',
        'online.viewAll': 'View all',
        'online.searchResults': 'Results',
        'online.loadMore': 'Load more',
        'online.loadingMore': 'Loading…',
        'online.emptyResults': 'No tracks found',
        'online.locatePlaying': 'Locate playing track',
        'online.noPlaying': 'Nothing is playing right now',
        'online.clearUnplayable': 'Remove unplayable tracks',
        'online.clearedUnplayable': 'Removed {n} unplayable track(s)',
        'online.removeFromHistory': 'Remove from recently played',
        'online.removedFromHistory': 'Removed from recently played',
        'online.vipOnly': 'VIP / paid tracks cannot play without a membership',
        'online.vipSkipped': 'Skipped {n} VIP track(s) — this account has no membership',
        'online.album': 'Album',
        'online.albumFailed': 'Could not load album tracks',
        'online.quality': 'Quality',
        'online.qualityStandard': 'Standard',
        'online.qualityHigh': 'High',
        'online.qualityLossless': 'Lossless',
        'online.qualitySaved': 'Quality saved',
        'online.cache': 'Cache',
        'online.cacheSize': '{n} used · {files} files',
      'online.cacheListHint': 'The list only shows songs with cached audio; covers, lyrics and metadata also count toward the file total.',
        'online.refresh': 'Refresh',
        'online.clearCache': 'Clear cache',
        'online.cacheCleared': 'Cache cleared',
        'online.cached': 'Cached',
        'online.cacheProgress': 'Caching {pct}%',
        'online.cacheList': 'Cache',
        'online.cacheEmpty': 'Nothing cached yet',
        'online.removeCache': 'Remove from cache',
        'online.cacheRemoved': 'Removed',
        'online.hasLyric': 'lyrics',
        'online.networkError': 'Network request failed, please retry',
        'online.loginExpired': 'Sign-in expired, please sign in again (Settings → Online)',
        'online.authExpired': 'Session expired',
        'online.authExpiredHint': 'Your sign-in for this provider is no longer valid. Sign in again to load your playlists.',
        'online.relogin': 'Sign in again',
        'online.retry': 'Retry',
        'online.playlistsError': "Couldn't load playlists",
        'online.playFailed': 'Online playback failed — skipped',
        'online.online': 'Online',
        'online.modeSearch': 'Search',
        'online.modePlaylists': 'My playlists',
        'online.back': 'Back',
        'online.playlistsHint': 'Sign in to see your playlists here; use Settings → Online to scan a QR code.',
        'page.tabStats': 'Stats',
        'page.tabAlbums': 'Albums',
        'page.tabArtists': 'Artists',
        'page.tabFolders': 'Folders',
        'page.folder': 'Folder',
        'page.folderEmpty': 'No folders found',
        'page.unknownAlbum': 'Unknown album',
        'page.clearFilter': 'Clear',
        'page.trackCountUnit': '{n} songs',
        'page.tabPlaylists': 'Playlists',
        'page.newPlaylist': 'New playlist',
        'page.playlistName': 'Playlist name',
        'page.create': 'Create',
        'page.delete': 'Delete',
        'page.cancel': 'Cancel',
        'page.deleteConfirm': 'Delete “{name}”? This cannot be undone.',
        'page.back': 'Back',
        'page.playAll': 'Play all',
        'page.playbackFailed': 'Cannot play: {reason}',
        'page.playbackFailedNoReason': 'Cannot play; skipped to the next track',
        'page.addTo': 'Add to playlist',
        'page.addToPlaylist': 'Add to play queue',
        'page.addedToPlaylist': 'Added to play queue',
        'page.reveal': 'Show in folder',
        'page.revealed': 'Opened in folder',
        'page.favoriteSelected': 'Like selected',
        'page.batchEdit': 'Batch edit',
        'page.batchHint': 'Applies to {n} selected songs; empty fields are left untouched',
        'page.batchSaved': 'Updated {n} songs',
        'page.batchEmpty': 'No fields to change',
        'page.keepEmpty': 'Leave empty to keep',
        'page.duplicates': '{n} duplicates',
        'page.duplicatesTitle': 'Duplicate songs',
        'page.duplicatesHint': 'Same title, artist and duration — possibly the same file twice',
        'page.deleteDuplicates': 'Delete duplicates (keep best quality)',
        'page.deleteDuplicatesConfirm': 'Keep the best of each group by bitrate → sample rate → file size, and move the other {n} files to the plugin trash (recoverable)?',
        'page.duplicatesRemoved': 'Moved {n} files',
        'page.onlineLyrics': 'Online lyrics',
        'page.onlineLyricsAction': 'Search',
        'page.lyricsSearch': 'Search',
        'page.lyricsSearchPlaceholder': 'Song title',
        'page.lyricsNoResults': 'No lyrics found',
        'page.lyricsLineCount': '{n} lines',
        'page.lyricsBack': 'Back to results',
        'page.lyricsPreviewHint': 'Pick a result to preview',
        'page.lyricsSave': 'Save as .lrc',
        'page.lyricsApply': 'Apply',
        'page.lyricsSaved': 'Lyrics written into the file',
        'settings.sleepTimer': 'Sleep timer',
        'settings.sleepOff': 'Off',
        'settings.sleepTimerDone': 'Sleep timer finished — playback paused',
        'sleep.remaining': '{time} left',
        'sleep.hint': 'Playback pauses when the timer ends',
        'sleep.presets': 'Quick presets',
        'sleep.custom': 'Custom',
        'sleep.minutes': 'min',
        'sleep.set': 'Set',
        'sleep.placeholder': 'Minutes',
        'sleep.invalid': 'Enter 1–720 minutes',
        'onboarding.title': 'Welcome to dsh-music-panel',
        'onboarding.skip': 'Skip',
        'onboarding.back': 'Back',
        'onboarding.next': 'Next',
        'onboarding.start': 'Get started',
        'onboarding.pickFolder': 'Pick a folder',
        'onboarding.reopen': 'Show the guide',
        'onboarding.step1Icon': '📂',
        'onboarding.step1Title': 'Add your music folder',
        'onboarding.step1Text': 'On the empty library page, click "Add folder" and pick your music directory. Everything is scanned locally — covers, tags and all.',
        'onboarding.step2Icon': '▶️',
        'onboarding.step2Title': 'Double-click to play',
        'onboarding.step2Text': 'Double-click any song to start; the bar below handles next/previous, the queue and shuffle. Space pauses, Ctrl/⌘ + ←/→ skips.',
        'onboarding.step3Icon': '🎧',
        'onboarding.step3Title': 'Make the library complete',
        'onboarding.step3Text': 'Right-click a song to edit tags, match covers and metadata online, or search online lyrics. The "Aa" panel on the player page tunes the lyric style.',
        'page.details': 'Details',
        'page.noPlaylists': 'No playlists yet',
        'page.newPlaylistAdd': 'New playlist and add',
        'page.editMeta': 'Edit metadata',
        'page.metaTitle': 'Title',
        'page.year': 'Year',
        'page.trackNo': 'Track no.',
        'page.discNo': 'Disc no.',
        'page.genre': 'Genre',
        'page.albumArtist': 'Album artist',
        'page.composer': 'Composer',
        'page.lyricist': 'Lyricist',
        'page.comment': 'Comment',
        'page.lyrics': 'Lyrics',
        'page.lyricsPlaceholder': 'LRC timestamps supported; paste text or search online',
        'page.save': 'Save',
        'page.saving': 'Saving…',
        'page.metaSaved': 'Metadata saved',
        'page.metaHint': 'Changes are written to the audio file tags (FLAC / MP3). Cover art and untouched tags are preserved.',
        'page.metaBasic': 'Basic info',
        'page.metaDetail': 'Credits',
        'page.onlineMatch': 'Match online',
        'page.onlineHint': 'Online matching uses NetEase / QQ Music (unofficial endpoints) plus iTunes / MusicBrainz. Results can be incomplete or stop working at any time.',
        'page.onlineLoading': 'Searching online…',
        'page.onlineEmpty': 'No matching result',
        'page.onlineResults': 'Online results',
        'page.sourceNetease': 'NetEase',
        'page.sourceQq': 'QQ Music',
        'page.sourceItunes': 'iTunes',
        'page.sourceMusicbrainz': 'MusicBrainz',
        'page.results': 'results',
        'page.replaceCover': 'Change cover',
        'page.resetCover': 'Reset cover',
        'page.coverPending': 'Online cover selected — saved with tags',
        'page.matchField': 'Search & replace',
        'page.listView': 'List view',
        'page.addedCount': '{n} added',
        'page.trackCount': '{n} tracks',
        'page.removeTrack': 'Remove from playlist',
        'page.playlistEmpty': 'No playlists yet',
        'page.playlistEmptyHint': 'Use the + button above to create one.',
        'page.playlistNoTracks': 'This playlist has no tracks',
        'page.playlistNoTracksHint': 'Select tracks under Songs, then add them here.',
        'page.rename': 'Save',
        'settings.label': 'Music',
        'settings.title': 'Music folders',
        'settings.hint': 'Add folders with audio files. Supports mp3 / flac / m4a / wav / ogg / opus / aac.',
        'settings.roots': 'Folders',
        'settings.add': 'Add folder',
        'settings.remove': 'Remove',
        'settings.placeholder': 'e.g. D:\\Music or ~/Music',
        'settings.depth': 'Subfolder depth',
        'settings.depthHint': '0 scans only the selected folders; the default is 4 levels.',
        'settings.save': 'Save',
        'settings.saving': 'Saving…',
        'settings.saved': 'Saved',
        'settings.failed': 'Save failed',
        'settings.badRoot': 'These folders are not usable:',
        'settings.empty': 'No folders added yet.',
        'settings.note': 'Settings are stored in music/settings.json under your DSH home.',
        'settings.tabAppearance': 'Appearance',
        'settings.tabLyrics': 'Lyrics',
        'settings.tabLibrary': 'Library',
        'settings.tabPlayback': 'Playback',
        'settings.resumeOnStart': 'Resume last playback on start',
        'settings.autoResume': 'Start playing after restore',
        'settings.rememberPerTrack': 'Remember each track position',
        'settings.playbackHint': 'Play counts follow the Last.fm rule: a track longer than 30 seconds counts once after half its duration or 4 minutes, whichever comes first. Listening time only counts time actually played.',
        'settings.libraryHint': 'Music folders (auto-saved)',
        'settings.foldersTitle': 'Music folders',
        'settings.scannedTracks': '{n} tracks scanned',
        'settings.scanSettings': 'Scan settings',
        'settings.openTrash': 'Open',
        'settings.formatsHint': 'MP3 / FLAC / M4A / AAC / OGG / OPUS / WAV / AIFF / WMA / APE',
        'settings.scanWarnings': '{n} scan warnings',
        'settings.removeConfirm': 'Remove this music folder? Files are not deleted.',
        'settings.up': '↑ Up',
        'settings.chooseFolder': 'Choose this folder',
        'settings.pickEmpty': 'No folder selected.',
        'settings.pickFailed': 'Could not read the folder path. Try again or type it manually.',
        'settings.miniPlayer': 'Mini player window',
        'settings.composerQueueButton': 'Playlist button in composer',
        'settings.circularCover': 'Circular cover on player page',
        'v2.coverStyle': 'Now-playing cover style',
        'v2.coverStyleDesc': 'Square shows the full artwork; vinyl simulates a record',
        'v2.coverSquare': 'Square',
        'v2.coverVinyl': 'Vinyl',
        'settings.vinylRing': 'Vinyl ring behind the cover',
        'settings.coverSpin': 'Rotate the cover',
        'settings.lyricOrder': 'Lyric source order',
        'settings.lyricSourceEmbedded': 'Embedded',
        'settings.lyricSourceLrc': 'LRC file',
        'settings.lyricAlign': 'Lyric alignment',
        'settings.alignCenter': 'Center',
        'settings.alignLeft': 'Left',
        'settings.alignRight': 'Right',
        'settings.lyricSize': 'Lyric font size',
        'settings.lyricBlur': 'Blur inactive lines',
        'settings.lyricTranslation': 'Lyric translation',
        'settings.translationScale': 'Translation scale',
        'settings.composerLyrics': 'Composer lyrics',
        'settings.composerTranslation': 'Composer lyric translation',
        'settings.composerTranslationDesc': 'Turn off to show only the original line above the input',
        'settings.composerLyricPlace': 'Composer lyric position',
        'settings.placeInputLeft': 'Left of the queue button',
        'settings.placeAbove': 'Above input',
      },
    }

    var LANG = (function () {
      var lang = ''
      try {
        lang = document.documentElement.getAttribute('lang') || (navigator && navigator.language) || ''
      } catch (error) {
        lang = ''
      }
      return String(lang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
    })()

    /**
     * Bound to the host locale service when the plugin applies; null keeps the
     * built-in dictionary plus the document-language guess.
     */
    var localeTranslate = null

    function t(key, vars) {
      var text = null
      if (localeTranslate !== null) {
        try {
          text = localeTranslate(key, vars)
        } catch (error) {
          text = null
        }
      }
      if (typeof text !== 'string' || text === '' || text === key) {
        var dict = DICTS[LANG] || DICTS.zh
        text = dict[key] !== undefined ? dict[key] : DICTS.zh[key] !== undefined ? DICTS.zh[key] : key
      }
      if (vars !== undefined && vars !== null) {
        Object.keys(vars).forEach(function (name) {
          text = text.split('{' + name + '}').join(String(vars[name]))
        })
      }
      return text
    }

    // ── src/06-strings.js
    /**
     * strings: keys introduced by the v2 UI.
     *
     * The large zh/en dictionaries from 0.11.1 stay in 05-i18n; this file only adds
     * the labels the new shell needs, so both languages keep working.
     */

    var EXTRA_STRINGS = {
      zh: {
        'v2.songs': '歌曲',
        'v2.albums': '专辑',
        'v2.artists': '歌手',
        'v2.folders': '文件夹',
        'v2.favorites': '喜欢',
        'v2.playlists': '歌单',
        'v2.expandPlaylists': '展开',
        'v2.stats': '统计',
        'v2.recent': '最近播放',
        'v2.cache': '缓存',
        'v2.sectionLibrary': '音乐库',
        'v2.sectionCollection': '收藏',
        'v2.sectionOnline': '在线',
        'v2.allSongs': '全部歌曲',
        'v2.layout': '布局',
        'v2.layoutTop': '顶栏分区',
        'v2.layoutRail': '左侧导航',
        'v2.layoutHint': '顶栏分区不会和宿主左侧栏重复；左侧导航适合歌单很多时常驻浏览。',
        'v2.clearFilter': '全部',
        'v2.loading': '正在加载…',
        'v2.scanning': '正在扫描曲库…',
        'v2.scanFailed': '曲库加载失败',
        'v2.noTracks': '还没有音乐',
        'v2.noTracksHint': '在设置 → 音乐库添加文件夹，然后点刷新。',
        'v2.noFavorites': '还没有喜欢的歌',
        'v2.noFavoritesHint': '点歌曲右侧的爱心加入喜欢。',
        'v2.noPlaylistTracks': '这个歌单还没有歌',
        'v2.noHistory': '还没有播放记录',
        'v2.noHistoryHint': '在线播放过的歌会出现在这里。',
        'v2.noPlaylists': '还没有歌单',
        'v2.newPlaylist': '新建歌单',
        'v2.playlistName': '歌单名称',
        'v2.rename': '重命名',
        'v2.delete': '删除',
        'v2.close': '关闭',
        'v2.back': '全部',
        'v2.cached': '已缓存',
        'v2.cacheProgress': '缓存中 {pct}%',
        'v2.sortTitle': '标题',
        'v2.sortArtist': '歌手',
        'v2.sortDuration': '时长',
        'v2.sortAdded': '添加时间',
        'v2.sortRecent': '最近播放',
        'v2.appearance': '外观',
        'v2.lyrics': '歌词',
        'v2.playback': '播放',
        'v2.library': '音乐库',
        'v2.folderAdd': '添加文件夹',
        'v2.folderPick': '选择文件夹',
        'v2.folderUp': '上一级',
        'v2.folderHere': '使用此文件夹',
        'v2.folderHidden': '已隐藏',
        'v2.folderVisible': '显示中',
        'v2.folderHideHint': '隐藏这个文件夹里的歌曲',
        'v2.folderAdded': '已添加文件夹',
        'v2.folderEmpty': '没有子文件夹',
        'v2.folderBrowse': '浏览…',
        'online.addedToCloudPlaylist': '已加入歌单',
        'online.noCloudPlaylists': '还没有云端歌单',
        'online.addToCloudPlaylist': '添加到歌单',

        'v2.online': '在线',
        'v2.cacheTab': '缓存',
        'v2.about': '关于',
        'online.cacheSongs': '缓存歌曲',
        'online.qqAccount': 'QQ 音乐用户',
        'online.cacheNoSongs': '还没有缓存的歌曲',
        'v2.playlistSort': '歌单排序',
        'v2.sortSource': '平台顺序',
        'v2.sortName': '名称',
        'v2.sortCount': '歌曲数',
        'about.tagline': '本地与在线音乐，一个面板。',
        'about.version': '版本',
        'about.project': '项目',
        'about.license': '许可证',
        'about.author': '作者',
        'about.feedback': '问题反馈',
        'about.description': '多目录曲库、网易云 / QQ / 酷狗在线播放、歌词翻译、标签与封面编辑、音频缓存、统计与回收站。',
        'about.source': 'GitHub 源码',
        'about.npm': 'npm 包',
        'settings.volumeNormalize': '音量均衡',
        'settings.volumeNormalizeOff': '已关闭',
        'settings.volumeNormalizeReady': '已生效 · 内置 EBU R128 分析',
        'settings.volumeNormalizeMissing': '未生效 · 浏览器不支持 Web Audio',
        'settings.volumeNormalizeMissingHint': '请使用支持 Web Audio 的 DSH Web / Desktop。',
        'settings.volumeNormalizeHint': '浏览器内置 EBU R128 分析，按曲目响度自动调整增益；首次分析需要几秒。',
        'settings.crossfade': '智能过渡',
        'settings.crossfadeHint': '分析前后两首歌首尾的响度，自动选择切入点和重叠长度；同专辑连续曲目保持原始的硬切衔接。',
        'settings.crossfadeRuntimeHint': '需要 Web Audio；浏览器不支持或音源跨域时会自动跳过。',
        'v2.listenTime': '累计播放时长',
        'v2.totalPlays': '总播放次数',
        'v2.trackedTracks': '有记录曲目',
        'v2.rangeAll': '全部时间',
        'v2.rangeWeek': '最近一周',
        'v2.rangeMonth': '最近一月',
        'v2.playing': '正在播放',
        'v2.lyricSettings': '歌词设置',
        'v2.removeSelectedConfirm': '把选中的 {n} 首移到回收站（可恢复）？',
        'v2.removed': '已移除 {n} 首',
        'v2.match': '在线匹配',
        'v2.minutes': '{n} 分钟',
        'v2.pickTrack': '从列表里选一首歌开始播放',
        'v2.selAll': '全部选择',
        'v2.hostKit': '宿主组件',
        'v2.hostKitDesc': 'native = 正在使用 DSH 官方组件；fallback = 本地回退实现',
        'v2.hostKitNative': 'native',
        'v2.hostKitFallback': 'fallback',
        'v2.selNone': '全部取消',
        'v2.selRange': '区域选择',
        'v2.selInvert': '反向选择',
        'v2.rangePickHint': '区域选择：先点起点，再点终点',
        'v2.searchFocus': '搜索',
        'v2.sleepRemaining': '剩余 {time}',
        'v2.sleepCancel': '取消定时',
        'v2.cover': '封面',
        'v2.matchHint': '点整行应用全部；点字段只应用该字段',
        'v2.trash': '回收站',
        'v2.trashHint': '删除的曲目会移到这里，可随时恢复',
        'v2.trashEmpty': '回收站是空的',
        'v2.restore': '恢复',
        'v2.restored': '已恢复：{name}',
        'v2.trashNoPath': '原路径未知',
        'v2.spin': '封面旋转',
        'v2.spinDesc': '播放时唱片转动',
        'v2.roundCover': '圆形封面',
        'v2.vinylRing': '黑胶环',
        'v2.vinylRingDesc': '圆形封面外圈的唱片纹路',
        'v2.roundCoverDesc': '列表行使用圆形封面',
        'v2.paused': '已暂停',
        'v2.filters': '筛选',
        'v2.albumFilter': '专辑：{name}',
        'v2.artistFilter': '歌手：{name}',
        'v2.folderFilter': '文件夹：{name}',
        'v2.playAllHint': '从第一首开始播放',
        'v2.queueHint': '点击播放，右键更多操作',
        'v2.loginNeeded': '登录后可查看歌单',
        'v2.relogin': '重新登录',
        'v2.logout': '退出登录',
        'page.audioEffects': '音频效果',
        'eq.title': '均衡器',
        'eq.enable': '启用均衡器',
        'eq.tabPresets': '预设',
        'eq.tabDevices': '设备',
        'eq.tabMine': '我的',
        'eq.tabEdit': '编辑',
        'eq.searchDevice': '搜索耳机型号',
        'eq.searching': '搜索中…',
        'eq.searchEmpty': '没有匹配的型号',
        'eq.searchFailed': '预设加载失败',
        'eq.loadMore': '加载更多',
        'eq.deviceCount': '已显示 {shown} / 共 {total} 条',
        'eq.deviceCurrent': '当前设备：{name}',
        'eq.formInEar': '入耳',
        'eq.formOverEar': '头戴',
        'eq.formEarbud': '半入耳',
        'eq.preamp': '前置增益',
        'eq.preampHint': '多段提升时自动衰减防削波，可在这里补回。',
        'eq.reset': '重置',
        'eq.saveCurrent': '保存当前设置',
        'eq.save': '保存',
        'eq.cancel': '取消',
        'eq.savePlaceholder': '预设名称',
        'eq.saved': '已保存',
        'eq.needName': '先输入预设名称',
        'eq.delete': '删除',
        'eq.empty': '还没有自定义预设',
        'eq.emptyHint': '在「编辑」里调好后点保存。',
        'eq.unavailable': '当前环境无法启用均衡器：浏览器不支持 Web Audio，或该音源跨域。',
      },
      en: {
        'v2.songs': 'Songs',
        'v2.albums': 'Albums',
        'v2.artists': 'Artists',
        'v2.folders': 'Folders',
        'v2.favorites': 'Favorites',
        'v2.playlists': 'Playlists',
        'v2.expandPlaylists': 'Show all',
        'v2.stats': 'Stats',
        'v2.recent': 'Recent',
        'v2.cache': 'Cache',
        'v2.sectionLibrary': 'Library',
        'v2.sectionCollection': 'Collection',
        'v2.sectionOnline': 'Online',
        'v2.allSongs': 'All songs',
        'v2.layout': 'Layout',
        'v2.layoutTop': 'Top sections',
        'v2.layoutRail': 'Left rail',
        'v2.layoutHint': 'Top sections avoid a second sidebar next to the host; the left rail is better for many playlists.',
        'v2.clearFilter': 'All',
        'v2.loading': 'Loading…',
        'v2.scanning': 'Scanning library…',
        'v2.scanFailed': 'Failed to load library',
        'v2.noTracks': 'No music yet',
        'v2.noTracksHint': 'Add a folder in Settings → Library, then refresh.',
        'v2.noFavorites': 'No favorites yet',
        'v2.noFavoritesHint': 'Use the heart on a row to add one.',
        'v2.noPlaylistTracks': 'This playlist is empty',
        'v2.noHistory': 'No history yet',
        'v2.noHistoryHint': 'Tracks you play online show up here.',
        'v2.noPlaylists': 'No playlists yet',
        'v2.newPlaylist': 'New playlist',
        'v2.playlistName': 'Playlist name',
        'v2.rename': 'Rename',
        'v2.delete': 'Delete',
        'v2.close': 'Close',
        'v2.back': 'All',
        'v2.cached': 'Cached',
        'v2.cacheProgress': 'Caching {pct}%',
        'v2.sortTitle': 'Title',
        'v2.sortArtist': 'Artist',
        'v2.sortDuration': 'Duration',
        'v2.sortAdded': 'Date added',
        'v2.sortRecent': 'Recently played',
        'v2.appearance': 'Appearance',
        'v2.lyrics': 'Lyrics',
        'v2.playback': 'Playback',
        'v2.library': 'Library',
        'v2.folderAdd': 'Add folder',
        'v2.folderPick': 'Choose folder',
        'v2.folderUp': 'Up',
        'v2.folderHere': 'Use this folder',
        'v2.folderHidden': 'Hidden',
        'v2.folderVisible': 'Visible',
        'v2.folderHideHint': 'Hide songs inside this folder',
        'v2.folderAdded': 'Folder added',
        'v2.folderEmpty': 'No subfolders',
        'v2.folderBrowse': 'Browse…',
        'online.addedToCloudPlaylist': 'Added to playlist',
        'online.noCloudPlaylists': 'No cloud playlists yet',
        'online.addToCloudPlaylist': 'Add to playlist',

        'v2.online': 'Online',
        'v2.cacheTab': 'Cache',
        'v2.about': 'About',
        'online.cacheSongs': 'Cached songs',
        'online.qqAccount': 'QQ Music user',
        'online.cacheNoSongs': 'No cached songs yet',
        'v2.playlistSort': 'Playlist order',
        'v2.sortSource': 'Platform order',
        'v2.sortName': 'Name',
        'v2.sortCount': 'Song count',
        'about.tagline': 'Local and online music, one panel.',
        'about.version': 'Version',
        'about.project': 'Project',
        'about.license': 'License',
        'about.author': 'Author',
        'about.feedback': 'Issues',
        'about.description': 'Multi-folder library, NetEase / QQ / KuGou / KuGou Concept playback, lyric translation, tag and cover editing, audio cache, stats and trash.',
        'about.source': 'GitHub source',
        'about.npm': 'npm package',
        'settings.volumeNormalize': 'Volume leveling',
        'settings.volumeNormalizeOff': 'Disabled',
        'settings.volumeNormalizeReady': 'Active · built-in EBU R128 analysis',
        'settings.volumeNormalizeMissing': 'Not active · Web Audio unsupported',
        'settings.volumeNormalizeMissingHint': 'Use a DSH Web / Desktop build with Web Audio support.',
        'settings.volumeNormalizeHint': 'Built-in EBU R128 analysis adjusts each track to avoid jumps between songs; the first analysis takes a few seconds.',
        'settings.crossfade': 'Smart transition',
        'settings.crossfadeHint': 'Measures how both tracks start and end, then picks the cut point and overlap length itself; consecutive tracks of one album keep their original hard join.',
        'settings.crossfadeRuntimeHint': 'Needs Web Audio; skipped when the browser or the source cannot route through it.',
        'v2.listenTime': 'Listening time',
        'v2.totalPlays': 'Total plays',
        'v2.trackedTracks': 'Tracks tracked',
        'v2.rangeAll': 'All time',
        'v2.rangeWeek': 'Last week',
        'v2.rangeMonth': 'Last month',
        'v2.playing': 'Playing',
        'v2.lyricSettings': 'Lyric settings',
        'v2.removeSelectedConfirm': 'Move {n} selected tracks to the trash (recoverable)?',
        'v2.removed': 'Removed {n} tracks',
        'v2.match': 'Online match',
        'v2.minutes': '{n} min',
        'v2.pickTrack': 'Pick a track from the list to start',
        'v2.selAll': 'Select all',
        'v2.hostKit': 'Host components',
        'v2.hostKitDesc': 'native = using DSH primitives; fallback = local implementations',
        'v2.hostKitNative': 'native',
        'v2.hostKitFallback': 'fallback',
        'v2.selNone': 'Clear selection',
        'v2.selRange': 'Range select',
        'v2.selInvert': 'Invert selection',
        'v2.rangePickHint': 'Range select: click the start, then the end',
        'v2.searchFocus': 'Search',
        'v2.sleepRemaining': '{time} left',
        'v2.sleepCancel': 'Cancel timer',
        'v2.cover': 'Cover',
        'v2.matchHint': 'Click a row to apply everything, or a field chip for just that field',
        'v2.trash': 'Trash',
        'v2.trashHint': 'Removed tracks land here and can be restored',
        'v2.trashEmpty': 'The trash is empty',
        'v2.restore': 'Restore',
        'v2.restored': 'Restored: {name}',
        'v2.trashNoPath': 'Original path unknown',
        'v2.spin': 'Cover rotation',
        'v2.spinDesc': 'The disc spins while playing',
        'v2.roundCover': 'Round covers',
        'v2.vinylRing': 'Vinyl ring',
        'v2.vinylRingDesc': 'Record grooves around a circular cover',
        'v2.roundCoverDesc': 'Use round covers in lists',
        'v2.paused': 'Paused',
        'v2.filters': 'Filters',
        'v2.albumFilter': 'Album: {name}',
        'v2.artistFilter': 'Artist: {name}',
        'v2.folderFilter': 'Folder: {name}',
        'v2.playAllHint': 'Start from the first track',
        'v2.queueHint': 'Click to play, right-click for more',
        'v2.loginNeeded': 'Sign in to see playlists',
        'v2.relogin': 'Sign in again',
        'v2.logout': 'Sign out',
        'page.audioEffects': 'Audio effects',
        'eq.title': 'Equalizer',
        'eq.enable': 'Enable equalizer',
        'eq.tabPresets': 'Presets',
        'eq.tabDevices': 'Devices',
        'eq.tabMine': 'Mine',
        'eq.tabEdit': 'Edit',
        'eq.searchDevice': 'Search headphones',
        'eq.searching': 'Searching…',
        'eq.searchEmpty': 'No matching model',
        'eq.searchFailed': 'Could not load presets',
        'eq.loadMore': 'Load more',
        'eq.deviceCount': '{shown} of {total}',
        'eq.deviceCurrent': 'Current: {name}',
        'eq.formInEar': 'in-ear',
        'eq.formOverEar': 'over-ear',
        'eq.formEarbud': 'earbud',
        'eq.preamp': 'Preamp',
        'eq.preampHint': 'Boosting several bands trims the level to avoid clipping; add it back here.',
        'eq.reset': 'Reset',
        'eq.saveCurrent': 'Save current',
        'eq.save': 'Save',
        'eq.cancel': 'Cancel',
        'eq.savePlaceholder': 'Preset name',
        'eq.saved': 'Saved',
        'eq.needName': 'Enter a preset name first',
        'eq.delete': 'Delete',
        'eq.empty': 'No saved presets yet',
        'eq.emptyHint': 'Tune the editor, then save it here.',
        'eq.unavailable': 'The equalizer cannot run here: Web Audio is unavailable, or this source is cross-origin.',
      },
    }

    Object.keys(EXTRA_STRINGS).forEach(function (lang) {
      if (!DICTS[lang]) return
      Object.keys(EXTRA_STRINGS[lang]).forEach(function (key) {
        DICTS[lang][key] = EXTRA_STRINGS[lang][key]
      })
    })

    // ── src/10-base.js
    /**
     * base: formatting, storage and small pure helpers.
     *
     * The playback engine (50-player) calls `clamp` and `pad2` directly and the
     * rest of the UI leans on the formatters, so these names are part of the
     * internal contract.
     */

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max)
    }

    /** Split a display artist string into distinct clickable artists. */
    function trackArtistNames(track) {
      var raw = String((track && track.artist) || '').trim()
      if (raw === '') return []
      var names = []
      function push(text) {
        var value = String(text || '').trim()
        if (value !== '' && names.indexOf(value) < 0) names.push(value)
      }
      raw.split(/\s+\/\s+|\s*[、&,，;；]\s*|\s+(?:feat\.?|ft\.?)\s+/i).forEach(function (part) {
        var text = String(part || '').trim()
        if (text === '') return
        // Split a bare slash only for CJK names ("许嵩/莫诗旎"), so AC/DC stays whole.
        if (/[\u3400-\u9fff]/.test(text) && text.indexOf('/') >= 0) {
          text.split('/').forEach(push)
        } else {
          push(text)
        }
      })
      return names
    }

    function pad2(value) {
      return value < 10 ? '0' + value : String(value)
    }

    /** Duration for track lists: unknown durations read as `--:--`. */
    function fmtTime(seconds) {
      if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return '--:--'
      var total = Math.floor(seconds)
      var s = total % 60
      var m = Math.floor(total / 60) % 60
      var hours = Math.floor(total / 3600)
      return hours > 0 ? hours + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s)
    }

    /** Player clock: always a number, zero reads as `0:00`. */
    function fmtClock(seconds) {
      var total = Math.floor(isFinite(seconds) && seconds > 0 ? seconds : 0)
      var s = total % 60
      var m = Math.floor(total / 60) % 60
      var hours = Math.floor(total / 3600)
      return hours > 0 ? hours + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s)
    }

    function fmtKhz(sampleRate) {
      if (typeof sampleRate !== 'number' || !isFinite(sampleRate) || sampleRate <= 0) return ''
      var khz = Math.round(sampleRate / 100) / 10
      return String(khz).replace(/\.0$/, '') + ' kHz'
    }

    function fmtKbps(bitrate) {
      if (typeof bitrate !== 'number' || !isFinite(bitrate) || bitrate <= 0) return ''
      return Math.round(bitrate / 1000) + ' kbps'
    }

    function fmtBytes(bytes) {
      var n = Number(bytes)
      if (!isFinite(n) || n <= 0) return '0 B'
      var units = ['B', 'KB', 'MB', 'GB', 'TB']
      var i = 0
      while (n >= 1024 && i < units.length - 1) {
        n = n / 1024
        i += 1
      }
      return (i === 0 ? String(Math.round(n)) : n.toFixed(1)) + ' ' + units[i]
    }

    /** Last.fm / MusicBee play threshold: half the track or four minutes. */
    function playThresholdOf(durationSec) {
      var duration = Number(durationSec)
      if (!isFinite(duration) || duration <= 0) return 240
      if (duration <= 30) return duration + 0.5
      return Math.min(duration / 2, 240)
    }

    function clampPref(value, min, max, fallback) {
      var number = Number(value)
      if (!isFinite(number)) return fallback
      return Math.min(max, Math.max(min, Math.round(number)))
    }

    /** Class name joiner: falsy values are dropped. */
    function cx() {
      var out = []
      for (var i = 0; i < arguments.length; i += 1) {
        var part = arguments[i]
        if (typeof part === 'string' && part !== '') out.push(part)
      }
      return out.join(' ')
    }

    function storageGet(key, fallback) {
      try {
        var raw = window.localStorage.getItem(key)
        if (raw === null || raw === undefined) return fallback
        return JSON.parse(raw)
      } catch (error) {
        return fallback
      }
    }

    function storageSet(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch (error) {
        // Private mode / quota: best effort only.
      }
    }

    function errorText(error) {
      if (error === null || error === undefined) return ''
      if (typeof error === 'string') return error
      if (typeof error.message === 'string' && error.message !== '') return error.message
      return String(error)
    }

    /** Absolute directory of a track (backslashes kept for display). */
    function trackDirOf(track) {
      var path = String((track && track.path) || '')
      var at = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
      return at > 0 ? path.slice(0, at) : path
    }

    /** Last path segment of a directory; drive roots fall back to "D:". */
    function folderNameOf(dir) {
      var text = String(dir || '').replace(/[\\/]+$/, '')
      var at = Math.max(text.lastIndexOf('\\'), text.lastIndexOf('/'))
      var name = at >= 0 ? text.slice(at + 1) : text
      return name || text || '/'
    }

    /** Stable, case-insensitive search across metadata, path and pinyin. */
    function trackHaystack(track) {
      return [
        track.title,
        track.artist,
        track.album,
        track.name,
        track.folder,
        track.path,
        track.py,
        track.pyf,
      ]
        .map(function (part) {
          return String(part || '').toLowerCase()
        })
        .join('\n')
    }

    function filterTracks(list, query) {
      var text = String(query || '').trim().toLowerCase()
      if (text === '') return list
      var needles = text.split(/\s+/).filter(Boolean)
      if (needles.length === 0) return list
      return list.filter(function (track) {
        var hay = trackHaystack(track)
        for (var i = 0; i < needles.length; i += 1) {
          if (hay.indexOf(needles[i]) < 0) return false
        }
        return true
      })
    }

    function sortTracks(list, key, dir) {
      var out = list.slice()
      var desc = dir === 'desc'
      out.sort(function (left, right) {
        var a
        var b
        switch (key) {
          case 'artist':
            a = String(left.artist || '')
            b = String(right.artist || '')
            break
          case 'album':
            a = String(left.album || '')
            b = String(right.album || '')
            break
          case 'duration':
            a = left.durationSec || 0
            b = right.durationSec || 0
            break
          case 'added':
            a = left.addedAt || 0
            b = right.addedAt || 0
            break
          case 'plays':
            a = left.plays || 0
            b = right.plays || 0
            break
          case 'recent':
            a = left.lastPlayedAt || 0
            b = right.lastPlayedAt || 0
            break
          default:
            a = String(left.title || '')
            b = String(right.title || '')
        }
        if (typeof a === 'number' && typeof b === 'number') return desc ? b - a : a - b
        var result = String(a).localeCompare(String(b), 'zh')
        return desc ? -result : result
      })
      return out
    }

    function basename(path) {
      var text = String(path || '')
      var slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'))
      return slash >= 0 ? text.slice(slash + 1) : text
    }

    // ── src/15-icons.js
    /**
     * inline SVG icon set (Feather/Lucide paths, MIT).
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */

    // ── icons (Feather/Lucide paths, MIT) ─────────────────────────────────

    var ICONS = {
      check: { parts: [['path', { d: 'M20 6L9 17l-5-5' }]] },
      clock: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 9 }],
          ['path', { d: 'M12 7v5l3 2' }],
        ],
      },
      download: {
        parts: [
          ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
          ['path', { d: 'M7 10l5 5 5-5' }],
          ['path', { d: 'M12 15V3' }],
        ],
      },
      target: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 7 }],
          ['circle', { cx: 12, cy: 12, r: 2.5 }],
          ['path', { d: 'M12 2v3M12 19v3M2 12h3M19 12h3' }],
        ],
      },
      refresh: {
        parts: [
          ['path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }],
          ['path', { d: 'M21 3v6h-6' }],
        ],
      },
      settings: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 3 }],
          [
            'path',
            {
              d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
            },
          ],
        ],
      },
      checkCircle: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 10 }],
          ['path', { d: 'M8 12.5l2.5 2.5L16 9.5' }],
        ],
      },
      sort: {
        parts: [
          ['path', { d: 'M7 4v16' }],
          ['path', { d: 'M4 7l3-3 3 3' }],
          ['path', { d: 'M17 20V4' }],
          ['path', { d: 'M14 17l3 3 3-3' }],
        ],
      },
      search: {
        parts: [
          ['circle', { cx: 11, cy: 11, r: 7 }],
          ['path', { d: 'M21 21l-4.3-4.3' }],
        ],
      },
      repeat: {
        parts: [
          ['path', { d: 'M17 2l4 4-4 4' }],
          ['path', { d: 'M3 11V9a4 4 0 014-4h14' }],
          ['path', { d: 'M7 22l-4-4 4-4' }],
          ['path', { d: 'M21 13v2a4 4 0 01-4 4H3' }],
        ],
      },
      repeatOne: {
        parts: [
          ['path', { d: 'M17 2l4 4-4 4' }],
          ['path', { d: 'M3 11V9a4 4 0 014-4h14' }],
          ['path', { d: 'M7 22l-4-4 4-4' }],
          ['path', { d: 'M21 13v2a4 4 0 01-4 4H3' }],
          ['path', { d: 'M12 10v4' }],
          ['path', { d: 'M11 11l1-1' }],
        ],
      },
      shuffle: {
        parts: [
          ['path', { d: 'M16 3h5v5' }],
          ['path', { d: 'M4 20L21 3' }],
          ['path', { d: 'M21 16v5h-5' }],
          ['path', { d: 'M15 15l6 6' }],
          ['path', { d: 'M4 4l5 5' }],
        ],
      },
      x: {
        parts: [
          ['path', { d: 'M18 6L6 18' }],
          ['path', { d: 'M6 6l12 12' }],
        ],
      },
      prev: {
        parts: [
          ['path', { d: 'M19 20L9 12l10-8v16z' }],
          ['path', { d: 'M5 19V5' }],
        ],
      },
      next: {
        parts: [
          ['path', { d: 'M5 4l10 8-10 8V4z' }],
          ['path', { d: 'M19 5v14' }],
        ],
      },
      play: { fill: true, parts: [['path', { d: 'M7 4.5v15l13-7.5-13-7.5z' }]] },
      pause: {
        fill: true,
        parts: [
          ['rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }],
          ['rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 }],
        ],
      },
      list: {
        parts: [
          ['path', { d: 'M8 6h13' }],
          ['path', { d: 'M8 12h13' }],
          ['path', { d: 'M8 18h13' }],
          ['path', { d: 'M3 6h.01' }],
          ['path', { d: 'M3 12h.01' }],
          ['path', { d: 'M3 18h.01' }],
        ],
      },
      more: {
        parts: [
          ['circle', { cx: 5, cy: 12, r: 1.4 }],
          ['circle', { cx: 12, cy: 12, r: 1.4 }],
          ['circle', { cx: 19, cy: 12, r: 1.4 }],
        ],
      },
      volume: {
        parts: [
          ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
          ['path', { d: 'M15.5 8.5a5 5 0 010 7' }],
          ['path', { d: 'M18.5 5.5a9 9 0 010 13' }],
        ],
      },
      volumeLow: {
        parts: [
          ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
          ['path', { d: 'M15.5 8.5a5 5 0 010 7' }],
        ],
      },
      equalizer: {
        parts: [
          ['path', { d: 'M4 10v4' }],
          ['path', { d: 'M8 7v10' }],
          ['path', { d: 'M12 4v16' }],
          ['path', { d: 'M16 8v8' }],
          ['path', { d: 'M20 11v2' }],
        ],
      },
      mute: {
        parts: [
          ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
          ['path', { d: 'M22 9l-6 6' }],
          ['path', { d: 'M16 9l6 6' }],
        ],
      },
      note: {
        parts: [
          ['path', { d: 'M9 18V5l12-2v13' }],
          ['circle', { cx: 6, cy: 18, r: 3 }],
          ['circle', { cx: 18, cy: 16, r: 3 }],
        ],
      },
      heart: {
        parts: [
          ['path', { d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' }],
        ],
      },
      heartFill: {
        fill: true,
        parts: [
          ['path', { d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' }],
        ],
      },
      chevronDown: {
        parts: [['path', { d: 'M6 9l6 6 6-6' }]],
      },
      chevronLeft: {
        parts: [['path', { d: 'M15 18l-6-6 6-6' }]],
      },
      trash: {
        parts: [
          ['path', { d: 'M3 6h18' }],
          ['path', { d: 'M8 6V4h8v2' }],
          ['path', { d: 'M19 6l-1 14H6L5 6' }],
        ],
      },
      plus: {
        parts: [
          ['path', { d: 'M12 5v14' }],
          ['path', { d: 'M5 12h14' }],
        ],
      },
      folder: {
        parts: [['path', { d: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' }]],
      },
      copy: {
        parts: [
          ['rect', { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }],
          ['path', { d: 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1' }],
        ],
      },
      info: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 10 }],
          ['path', { d: 'M12 16v-4' }],
          ['path', { d: 'M12 8h.01' }],
        ],
      },
      edit: {
        parts: [
          ['path', { d: 'M12 20h9' }],
          ['path', { d: 'M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z' }],
        ],
      },
    }

    function merge(base, extra) {
      var out = {}
      Object.keys(base).forEach(function (key) {
        out[key] = base[key]
      })
      if (extra) {
        Object.keys(extra).forEach(function (key) {
          out[key] = extra[key]
        })
      }
      return out
    }

    function icon(name, size, extra) {
      var hostName = HOST_ICON_MAP && HOST_ICON_MAP[name]
      var HostIcon = hostName ? hostComponent(hostName) : null
      if (HostIcon !== null) {
        return h(HostIcon, { size: size || 18, 'aria-hidden': 'true', focusable: 'false' })
      }
      var spec = ICONS[name] || ICONS.note
      var children = spec.parts.map(function (part, index) {
        return h(part[0], merge({ key: String(index) }, part[1]))
      })
      var props = {
        width: size || 18,
        height: size || 18,
        viewBox: '0 0 24 24',
        'aria-hidden': 'true',
        focusable: 'false',
        fill: spec.fill === true ? 'currentColor' : 'none',
        stroke: spec.fill === true ? 'none' : 'currentColor',
        strokeWidth: 1.75,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }
      return h('svg', merge(props, extra), children)
    }

    // ── src/16-lyrics.js
    /**
     * LRC parsing, translation merge and online path helpers.
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */

    // ── online lyric helpers ──────────────────────────────────────────────
    // The Host returns raw LRC for online tracks (local tracks get parsed lines
    // from /lyrics), so the client needs a small parser of its own.
    function parseLrcText(text) {
      var lines = []
      String(text || '')
        .split(/\r?\n/)
        .forEach(function (raw) {
          var match = /^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/.exec(raw.trim())
          if (match === null) return
          var time = Number(match[1]) * 60 + Number(match[2])
          if (!isFinite(time)) return
          var content = match[3].trim()
          for (var i = 0; i < lines.length; i += 1) {
            if (lines[i].time === time) {
              if (lines[i].text === '' && content !== '') lines[i].text = content
              return
            }
          }
          lines.push({ time: time, text: content, translation: '' })
        })
      lines.sort(function (left, right) {
        return left.time - right.time
      })
      return lines
    }

    function isLyricMetadata(text) {
      var value = String(text || '').trim()
      if (value === '') return true
      if (/^(作词|作曲|编曲|制作|监制|出品|发行|录音|混音|母带|和声|吉他|贝斯|鼓|键盘|弦乐|词|曲)\s*[:：]/i.test(value)) {
        return true
      }
      return /^(lyrics?|composed|composer|arranged|arranger|producer|produced|mixed|mastered|written|music|words)\b[^:：]{0,24}[:：]/i.test(value)
    }

    function mergeLyricTranslation(lines, translationText) {
      var translated = parseLrcText(translationText)
      if (translated.length === 0) return lines

      // Match one translation line to one lyric line, globally nearest-first.
      // The old per-line nearest lookup reused the first translation on every
      // credit/meta line within 350ms (e.g. 作词/作曲/编曲 before the first verse).
      var candidates = []
      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i]
        if (isLyricMetadata(line.text)) continue
        for (var j = 0; j < translated.length; j += 1) {
          if (isLyricMetadata(translated[j].text)) continue
          var diff = Math.abs(translated[j].time - line.time)
          if (diff <= 0.35) candidates.push({ line: i, trans: j, diff: diff })
        }
      }
      candidates.sort(function (left, right) {
        if (left.diff !== right.diff) return left.diff - right.diff
        return left.line - right.line
      })
      var usedLines = {}
      var usedTrans = {}
      candidates.forEach(function (pair) {
        if (usedLines[pair.line] === true || usedTrans[pair.trans] === true) return
        var line = lines[pair.line]
        var text = translated[pair.trans].text
        if (isLyricMetadata(text)) return
        line.translation = text
        usedLines[pair.line] = true
        usedTrans[pair.trans] = true
      })
      return lines
    }

    /** Canonical `[mm:ss.xx]` used when writing translated lyrics back to a file. */
    function formatLrcTime(seconds) {
      var total = Math.max(0, Number(seconds) || 0)
      var minutes = Math.floor(total / 60)
      var rest = total - minutes * 60
      var whole = Math.floor(rest)
      var centis = Math.round((rest - whole) * 100)
      if (centis >= 100) {
        centis = 0
        whole += 1
      }
      if (whole >= 60) {
        whole -= 60
        minutes += 1
      }
      return '[' + pad2(minutes) + ':' + pad2(whole) + '.' + pad2(centis) + ']'
    }

    /**
     * Serialize parsed lines with translations back to the common bilingual LRC
     * shape: each translation repeats the original line's timestamp.
     *
     *   [00:05.12]原词
     *   [00:05.12]翻译词
     *
     * Metadata tags ([ti:], [ar:], [offset:], ...) are carried over unchanged.
     */
    function buildTranslatedLrc(lines, sourceText) {
      var prefix = String(sourceText || '')
        .split(/\r?\n/)
        .filter(function (line) {
          return /^\s*\[[A-Za-z#]+:[^\]]*\]/.test(line)
        })
      var body = []
      ;(Array.isArray(lines) ? lines : []).forEach(function (line) {
        if (!line || !isFinite(line.time) || line.time < 0) return
        var stamp = formatLrcTime(line.time)
        var text = String(line.text || '')
        var translation = String(line.translation || '')
        if (text === '' && translation === '') return
        if (text !== '') body.push(stamp + text)
        if (translation !== '') {
          translation.split(/\r?\n/).forEach(function (part) {
            if (part !== '') body.push(stamp + part)
          })
        }
      })
      return prefix.concat(body).join('\n')
    }

    /** Split `online:<provider>:<id>` (null when the path is a local one). */
    function onlinePathOf(path) {
      var match = /^online:([^:]+):(.+)$/.exec(String(path || ''))
      return match === null ? null : { provider: match[1], id: match[2] }
    }

    // ── src/17-list.js
    /**
     * windowed list (fixed row height).
     *
     * Renders the visible slice inside an absolutely positioned spacer. The list is
     * the single scroll container for a track view; `resetKey` decides when the
     * scroll position should go back to the top (view / filter / query change), so
     * a scan that adds or removes a track no longer jumps the list.
     */

    function VirtualList(props) {
      var rowHeight = props.rowHeight || 56
      var overscan = props.overscan === undefined ? 6 : props.overscan
      var topPair = useState(props.initialScroll || 0)
      var scrollTop = topPair[0]
      var setScrollTop = topPair[1]
      var viewPair = useState(600)
      var viewport = viewPair[0]
      var setViewport = viewPair[1]
      var ref = useRef(null)

      useEffect(function () {
        var element = ref.current
        if (element === null) return undefined
        function measure() {
          setViewport(element.clientHeight || 600)
        }
        measure()
        window.addEventListener('resize', measure)
        var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
        if (observer !== null) observer.observe(element)
        return function () {
          window.removeEventListener('resize', measure)
          if (observer !== null) observer.disconnect()
        }
      }, [])

      useEffect(
        function () {
          var element = ref.current
          var start = props.initialScroll || 0
          if (element !== null) element.scrollTop = start
          setScrollTop(start)
        },
        [props.resetKey],
      )

      var items = props.items || []

      useEffect(
        function () {
          if (!props.focusPath) return
          var index = -1
          for (var i = 0; i < items.length; i += 1) {
            if (items[i].path === props.focusPath) {
              index = i
              break
            }
          }
          if (index < 0) return
          var top = Math.max(0, index * rowHeight - Math.max(0, viewport / 2 - rowHeight / 2))
          if (ref.current !== null) ref.current.scrollTop = top
          setScrollTop(top)
        },
        [props.focusPath],
      )

      function onScroll(event) {
        var top = event.currentTarget.scrollTop
        setScrollTop(top)
        if (typeof props.onScrollTop === 'function') props.onScrollTop(top)
      }

      if (items.length === 0) {
        return h(
          'div',
          { className: props.className, ref: ref, onScroll: onScroll },
          props.empty || null,
        )
      }

      var total = items.length * rowHeight
      var start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
      var end = Math.min(items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan)
      var slice = items.slice(start, end)

      return h(
        'div',
        { className: props.className, ref: ref, onScroll: onScroll },
        h(
          'div',
          { className: 'mp-vlist-inner', style: { height: total + 'px' } },
          slice.map(function (item, offset) {
            var index = start + offset
            return h(
              'div',
              {
                key: props.itemKey ? props.itemKey(item, index) : index,
                className: 'mp-vlist-row',
                style: { height: rowHeight + 'px', top: index * rowHeight + 'px' },
              },
              props.renderRow(item, index),
            )
          }),
        ),
      )
    }

    // ── src/18-stats.js
    /**
     * stats formatting and folder helpers.
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */

    function basenameOf(path) {
      var parts = String(path || '').split(/[\\/]/)
      return parts.length > 0 ? parts[parts.length - 1] : String(path || '')
    }

    /** File name without its extension — the fallback "title" for untagged files. */
    function stemOf(path) {
      var name = basenameOf(path)
      var dot = name.lastIndexOf('.')
      return dot > 0 ? name.slice(0, dot) : name
    }

    /** Normalized folder (directory) part of a track path, no trailing slash. */
    function folderOf(filePath) {
      var normalized = String(filePath || '').replace(/\\/g, '/')
      var index = normalized.lastIndexOf('/')
      if (index <= 0) return ''
      return normalized.slice(0, index)
    }

    /** Human label for a folder: path relative to its scan root when possible. */
    function folderLabelOf(folder, roots) {
      var normalized = String(folder || '').replace(/\\/g, '/')
      for (var index = 0; index < roots.length; index += 1) {
        var root = String(roots[index] || '')
          .replace(/\\/g, '/')
          .replace(/\/+$/, '')
        if (root !== '' && (normalized === root || normalized.indexOf(root + '/') === 0)) {
          var relative = normalized.slice(root.length).replace(/^\/+/, '')
          return relative === '' ? root.split('/').pop() : relative
        }
      }
      var parts = normalized.split('/')
      return parts[parts.length - 1] || normalized
    }

    function fmtListenTime(seconds) {
      var total = Math.round(Number(seconds) || 0)
      if (total <= 0) return '—'
      var hours = Math.floor(total / 3600)
      var minutes = Math.floor((total % 3600) / 60)
      if (hours > 0) return hours + ' 小时 ' + minutes + ' 分'
      if (minutes > 0) return minutes + ' 分'
      return total + ' 秒'
    }

    function fmtRecent(ts) {
      var value = Number(ts)
      if (!isFinite(value) || value <= 0) return '—'
      var date = new Date(value)
      var now = new Date()
      var startOfDay = function (day) {
        return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
      }
      var days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
      if (days <= 0) return '今天'
      if (days === 1) return '昨天'
      if (days < 7) return days + ' 天前'
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
    }

    /**
     * Listening ranking: last week / month / all time, sorted by time, plays or
     * recency. Mirrors the NetEase "listening ranking" page, limited to what
     * the local library can know without a server.
     */

    // ── src/19-extra-icons.js
    /**
     * extra icons used by the v2 shell (the 0.11.1 set stays in 15-icons).
     */

    ICONS.user = { parts: [['circle', { cx: 12, cy: 8, r: 3.6 }], ['path', { d: 'M5 20a7 7 0 0 1 14 0' }]] }
    ICONS.chart = { parts: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M21 20H2' }]] }
    ICONS.disc = { parts: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 2.2 }]] }
    ICONS.qr = {
      parts: [
        ['rect', { x: 4, y: 4, width: 6, height: 6 }],
        ['rect', { x: 14, y: 4, width: 6, height: 6 }],
        ['rect', { x: 4, y: 14, width: 6, height: 6 }],
        ['path', { d: 'M14 14h3v3h-3zM19 17v3M14 20h2' }],
      ],
    }
    ICONS.translate = {
      parts: [
        ['path', { d: 'M3 6h8M7 6v2c0 4-2 7-4 8' }],
        ['path', { d: 'M5 12c1 2 3 3 5 3' }],
        ['path', { d: 'M13 20l4-10 4 10M14.5 16h5' }],
      ],
    }
    ICONS.logout = {
      parts: [
        ['path', { d: 'M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8' }],
        ['path', { d: 'M17 8l4 4-4 4M21 12H10' }],
      ],
    }
    ICONS.chevronRight = { parts: [['path', { d: 'M9 6l6 6-6 6' }]] }
    ICONS.lyrics = {
      parts: [
        ['path', { d: 'M4 5h16v12H9l-5 4V5z' }],
        ['path', { d: 'M8 9h8M8 13h5' }],
      ],
    }

    ICONS.playlist = {
      parts: [
        ['path', { d: 'M4 6h11' }],
        ['path', { d: 'M4 12h8' }],
        ['path', { d: 'M4 18h6' }],
        ['path', { d: 'M17 5v10.5' }],
        ['circle', { cx: 15.5, cy: 17.5, r: 2.5 }],
      ],
    }


    ICONS.maximize = {
      parts: [
        ['path', { d: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3' }],
      ],
    }
    ICONS.minimize = {
      parts: [
        ['path', { d: 'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3' }],
      ],
    }

    // ── src/20-api.js
    /**
     * api: every call into the Host half lives here.
     *
     * The playback engine expects `API`, `getJson`, `postJson`, `streamUrl` and
     * `coverUrl` under these exact names.
     */

    var API = 'music/'

    function streamUrl(path) {
      return API + 'stream?path=' + encodeURIComponent(path)
    }

    function coverUrl(path) {
      return API + 'cover?path=' + encodeURIComponent(path)
    }

    function onlineStreamUrl(provider, id) {
      return API + 'online/stream?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(id)
    }

    /**
     * Cover art for a self-hosted Navidrome/Subsonic server.
     *
     * The generic /online/cover route only allows the public provider CDNs, and a
     * Subsonic cover needs the stored salted token, so the Host proxies it from
     * the coverArt id alone.
     */
    function subsonicCoverUrl(coverArtId) {
      if (typeof coverArtId !== 'string' || coverArtId === '') return ''
      return API + 'online/subsonic-cover?provider=navidrome&id=' + encodeURIComponent(coverArtId)
    }

    async function getJson(url) {
      var response = await fetch(url, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      var body = null
      try {
        body = await response.json()
      } catch (error) {
        body = null
      }
      if (!response.ok || body === null || body.ok !== true) {
        var message =
          body !== null && body.error && body.error.message ? body.error.message : 'HTTP ' + response.status
        throw new Error(message)
      }
      return body
    }

    function postJson(url, payload) {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload === undefined ? {} : payload),
      }).then(function (response) {
        return response
          .json()
          .catch(function () {
            return null
          })
          .then(function (body) {
            if (!response.ok || body === null || body.ok !== true) {
              var error = new Error(
                body !== null && body.error && body.error.message
                  ? body.error.message
                  : 'HTTP ' + response.status,
              )
              error.body = body
              throw error
            }
            return body
          })
      })
    }

    /** PATCH / DELETE with the same envelope as postJson. */
    function sendJson(method, url, payload) {
      return fetch(url, {
        method: method,
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      }).then(function (response) {
        return response
          .json()
          .catch(function () {
            return null
          })
          .then(function (body) {
            if (!response.ok || body === null || body.ok !== true) {
              var error = new Error(
                body !== null && body.error && body.error.message
                  ? body.error.message
                  : 'HTTP ' + response.status,
              )
              error.body = body
              throw error
            }
            return body
          })
      })
    }

    /** Cover URL for a library or online track ('' when it has no art). */
    function trackCoverSrc(track) {
      if (!track) return ''
      if (track.onlineProvider) {
        // A self-hosted server's artwork needs its stored token, so it is proxied
        // by coverArt id rather than by URL; the generic route only allows the
        // public provider CDNs.
        if (track.onlineProvider === 'navidrome') return subsonicCoverUrl(track.coverArtId)
        return typeof track.coverUrl === 'string' && track.coverUrl !== ''
          ? API + 'online/cover?url=' + encodeURIComponent(track.coverUrl)
          : ''
      }
      if (track.hasCover === true && track.path) return coverUrl(track.path)
      return ''
    }

    /** Map one online search / playlist result into the queue's track shape. */
    function onlineTrackOf(result) {
      var provider = result.provider
      return {
        path: 'online:' + provider + ':' + result.id,
        title: result.title,
        artist: result.artist,
        album: result.album,
        albumId: result.albumId || '',
        durationSec: result.durationSec,
        hasCover: false,
        coverUrl: result.coverUrl || '',
        // Navidrome identifies artwork by id (`mf-…` song art, `al-…` album art),
        // which trackCoverSrc resolves through the host proxy.
        coverArtId: result.coverArtId || '',
        onlineUrl: onlineStreamUrl(provider, result.id),
        onlineProvider: provider,
        onlineId: result.id,
        qualityHint: result.qualityHint || '',
        addedAt: Number(result.addedAt || result.createdAt || 0) || 0,
        lastPlayedAt: Number(result.playedAt || result.lastPlayedAt || result.updatedAt || 0) || 0,
        sampleRate: 0,
        size: 0,
        mtime: 0,
      }
    }

    function onlineCoverSrc(result) {
      if (!result) return ''
      if (typeof result.coverArtId === 'string' && result.coverArtId !== '') return subsonicCoverUrl(result.coverArtId)
      if (typeof result.coverUrl !== 'string' || result.coverUrl === '') return ''
      return API + 'online/cover?url=' + encodeURIComponent(result.coverUrl)
    }

    // ── src/30-prefs.js
    /**
     * prefs: user preferences, persisted in localStorage.
     *
     * The playback engine calls `readPrefs()` / `savePrefs()` directly, so the
     * shape below must stay compatible with 0.11.1 (loop / order / volume /
     * resumeOnStart / rememberPerTrack / sleepTimerMinutes).
     */

    var PREFS_KEY = 'music.prefs.v2'
    var LEGACY_PREFS_KEY = 'dsh-music.prefs'

    var PREF_DEFAULTS = {
      layout: 'top',
      sortBy: 'title',
      sortDir: 'asc',
      circularCover: false,
      coverStyle: 'square',
      vinylRing: false,
      npLookMigrated: true,
      coverSpin: true,
      lyricOrder: ['embedded', 'lrc'],
      lyricAlign: 'left',
      lyricSize: 35,
      lyricGap: 15,
      lyricBlur: true,
      waveEnabled: true,
      showTranslation: true,
      translationScale: 90,
      npLayoutV2: false,
      composerLyrics: false,
      composerTranslation: true,
      composerLyricPlace: 'input-left',
      volume: 1,
      loop: 'none',
      order: 'list',
      resumeOnStart: true,
      sleepTimerMinutes: 0,
      sleepDeadline: 0,
      autoResume: false,
      rememberPerTrack: false,
      normalizeVolume: true,
      eqEnabled: false,
      eqPreset: 'flat',
      eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      eqPreamp: 0,
      /** Written on the first EQ change; an empty value means "old band grid". */
      eqLayout: '',
      eqDevice: '',
      eqCustom: [],
      /** 0 keeps the old hard cut; a positive value enables the automatic blend. */
      crossfadeSeconds: 0,
      onlinePlaylistSort: 'source',
      onboardingDone: true,
    }

    function readPrefs() {
      var merged = {}
      Object.keys(PREF_DEFAULTS).forEach(function (key) {
        merged[key] = PREF_DEFAULTS[key]
      })
      var raw = null
      try {
        raw = window.localStorage.getItem(PREFS_KEY)
      } catch (error) {
        raw = null
      }
      // One-time migration from the 0.11 key so nobody loses their settings.
      if (raw === null) {
        try {
          raw = window.localStorage.getItem(LEGACY_PREFS_KEY)
          if (raw !== null) window.localStorage.setItem(PREFS_KEY, raw)
        } catch (error) {
          raw = null
        }
      }
      if (raw === null) return merged
      try {
        var parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return merged
        Object.keys(parsed).forEach(function (key) {
          if (parsed[key] !== undefined && parsed[key] !== null) merged[key] = parsed[key]
        })
      } catch (error) {
        // Corrupt value: defaults stand.
      }
      merged.composerLyricPlace =
        String(merged.composerLyricPlace || '').indexOf('above') === 0 ? 'above' : 'input-left'
      // 0.12.0 briefly defaulted to square covers; restore the 0.11 player look once.
      if (merged.npLookMigrated !== true) {
        merged.circularCover = PREF_DEFAULTS.circularCover
        merged.npLookMigrated = true
        try {
          window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
        } catch (error) {
          // Best effort only.
        }
      }
      // One-time move to the reference now-playing layout (square cover, left lyrics,
      // denser lyric typography). Later user edits still win.
      if (merged.npLayoutV2 !== true) {
        merged.coverStyle = PREF_DEFAULTS.coverStyle
        merged.lyricAlign = PREF_DEFAULTS.lyricAlign
        merged.lyricSize = PREF_DEFAULTS.lyricSize
        merged.lyricBlur = PREF_DEFAULTS.lyricBlur
        merged.translationScale = PREF_DEFAULTS.translationScale
        merged.npLayoutV2 = true
        try {
          window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
        } catch (error) {
          // Best effort only.
        }
      }
      return merged
    }

    function savePrefs(patch) {
      var next = readPrefs()
      if (patch !== null && typeof patch === 'object') {
        Object.keys(patch).forEach(function (key) {
          next[key] = patch[key]
        })
      }
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch (error) {
        // Private mode / quota: preferences are best effort.
      }
      if (prefsStore !== undefined) prefsStore.set(next)
      return next
    }

    var prefsStore = createStore(readPrefs())

    function setPrefs(patch) {
      return savePrefs(patch)
    }

    // ── src/35-loudness.js
    /**
     * Self-contained EBU R128 integrated-loudness analysis.
     *
     * The browser's own decoder + OfflineAudioContext provide the K-weighting
     * filters, so no ffmpeg or npm runtime is required. Results are cached by
     * track path + file size and applied through the player's GainNode.
     */

    var LOUDNESS_CACHE_KEY = 'music.loudness.v1'
    var LOUDNESS_TARGET = -16
    var loudnessDecoder = null
    var loudnessCache = readLoudnessCache()

    function readLoudnessCache() {
      try {
        var raw = window.localStorage.getItem(LOUDNESS_CACHE_KEY)
        var parsed = raw === null ? null : JSON.parse(raw)
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch (error) {
        return {}
      }
    }

    function writeLoudnessCache(cache) {
      try {
        window.localStorage.setItem(LOUDNESS_CACHE_KEY, JSON.stringify(cache))
      } catch (error) {
        // Quota/private mode: in-memory cache still works.
      }
    }

    function loudnessCacheKey(item, blob) {
      return String(item.path || '') + '|' + String(blob.size || 0)
    }

    function lookupLoudnessGain(key) {
      var row = loudnessCache[key]
      var gain = row && Number(row.gainDb)
      return Number.isFinite(gain) ? gain : null
    }

    function storeLoudnessGain(key, gainDb) {
      loudnessCache[key] = { gainDb: gainDb, at: Date.now() }
      var keys = Object.keys(loudnessCache)
      if (keys.length > 1200) {
        keys
          .sort(function (left, right) {
            return (loudnessCache[left].at || 0) - (loudnessCache[right].at || 0)
          })
          .slice(0, keys.length - 1200)
          .forEach(function (old) {
            delete loudnessCache[old]
          })
      }
      writeLoudnessCache(loudnessCache)
    }

    function loudnessContext() {
      if (loudnessDecoder !== null) return loudnessDecoder
      var Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) return null
      try {
        loudnessDecoder = new Ctor()
      } catch (error) {
        loudnessDecoder = null
      }
      return loudnessDecoder
    }

    /** Integrated loudness in LUFS, following ITU-R BS.1770-4 / EBU R128. */
    function lufsFromAudioBuffer(buffer) {
      var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
      if (!Offline) return Promise.reject(new Error('OfflineAudioContext unavailable'))
      return new Promise(function (resolve, reject) {
        var offline
        try {
          offline = new Offline(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
          var source = offline.createBufferSource()
          source.buffer = buffer
          var shelf = offline.createBiquadFilter()
          shelf.type = 'highshelf'
          shelf.frequency.value = 1681.974450955533
          shelf.gain.value = 3.999843853973347
          shelf.Q.value = 0.7071752369554196
          var highpass = offline.createBiquadFilter()
          highpass.type = 'highpass'
          highpass.frequency.value = 38.13547087602444
          highpass.Q.value = 0.5003270373238773
          source.connect(shelf)
          shelf.connect(highpass)
          highpass.connect(offline.destination)
          source.start()
        } catch (error) {
          reject(error)
          return
        }
        offline
          .startRendering()
          .then(function (rendered) {
            var lufs = integratedLoudnessOf(rendered)
            if (lufs === null) reject(new Error('no gated loudness blocks'))
            else resolve(lufs)
          })
          .catch(reject)
      })
    }

    /** Mean square per gated 400 ms block, with surround channel weights. */
    function integratedLoudnessOf(buffer) {
      var sampleRate = buffer.sampleRate
      var blockSize = Math.round(0.4 * sampleRate)
      var step = Math.round(0.1 * sampleRate)
      if (blockSize <= 0 || buffer.length < blockSize) return null
      var channels = []
      for (var channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        channels.push(buffer.getChannelData(channel))
      }
      var weights = channels.map(function (_, index) {
        return index === 3 || index === 4 ? 1.41 : 1
      })
      var blocks = []
      for (var start = 0; start + blockSize <= buffer.length; start += step) {
        var energy = 0
        for (var ch = 0; ch < channels.length; ch += 1) {
          var data = channels[ch]
          var sum = 0
          for (var i = start; i < start + blockSize; i += 1) sum += data[i] * data[i]
          energy += weights[ch] * (sum / blockSize)
        }
        var loudness = -0.691 + 10 * Math.log10(energy)
        if (loudness > -70) blocks.push({ loudness: loudness, energy: energy })
      }
      if (blocks.length === 0) return null
      var absoluteEnergy =
        blocks.reduce(function (sum, block) {
          return sum + block.energy
        }, 0) / blocks.length
      var relativeGate = -0.691 + 10 * Math.log10(absoluteEnergy) - 10
      var gated = blocks.filter(function (block) {
        return block.loudness > relativeGate
      })
      if (gated.length === 0) return null
      var finalEnergy =
        gated.reduce(function (sum, block) {
          return sum + block.energy
        }, 0) / gated.length
      return -0.691 + 10 * Math.log10(finalEnergy)
    }

    function analyzeLoudnessBlob(item, blob, isCurrent, onGain) {
      if (!item || !blob || typeof isCurrent !== 'function') return Promise.resolve(null)
      var key = loudnessCacheKey(item, blob)
      var cached = lookupLoudnessGain(key)
      if (cached !== null) {
        if (isCurrent() && typeof onGain === 'function') onGain(cached)
        return Promise.resolve(cached)
      }
      var decoder = loudnessContext()
      if (decoder === null) return Promise.resolve(null)
      return blob
        .arrayBuffer()
        .then(function (bytes) {
          return decoder.decodeAudioData(bytes)
        })
        .then(function (buffer) {
          if (!isCurrent()) return null
          return lufsFromAudioBuffer(buffer)
        })
        .then(function (lufs) {
          if (lufs === null || !isCurrent()) return null
          var gainDb = clamp(LOUDNESS_TARGET - lufs, -15, 6)
          storeLoudnessGain(key, gainDb)
          if (typeof onGain === 'function') onGain(gainDb)
          return gainDb
        })
        .catch(function () {
          // Corrupt/unsupported file: keep the user volume.
          return null
        })
    }

    // ── src/35-provider-logos.js
    /** Official provider app icons (resized to 256px WebP for inline use). */
    var PROVIDER_LOGOS = {"navidrome":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBpZD0iTGF5ZXJfMSIgeD0iMCIgeT0iMCIgdmVyc2lvbj0iMS4xIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgNTEyIDUxMiI+PHBhdGggc3R5bGU9ImZpbGw6IzAwODRmZiIgZD0iTTI1NiwxMC40NDlDMTIwLjI3NSwxMC40NDksMTAuNDQ5LDEyMC4yNzYsMTAuNDQ5LDI1NmMwLDEzNS43MjUsMTA5LjgyNiwyNDUuNTUxLDI0NS41NTEsMjQ1LjU1MQlTNTAxLjU1MSwzOTEuNzI1LDUwMS41NTEsMjU2QzUwMS41NTEsMTIwLjI3NiwzOTEuNzI1LDEwLjQ0OSwyNTYsMTAuNDQ5eiIvPjxwYXRoIHN0eWxlPSJmaWxsOiNmZmYiIGQ9Ik0yNTYsMTY4LjIyOWMtNDguNTE1LDAtODcuNzcxLDM5LjI1Ny04Ny43NzEsODcuNzcxczM5LjI1Nyw4Ny43NzEsODcuNzcxLDg3Ljc3MQlzODcuNzcxLTM5LjI1Nyw4Ny43NzEtODcuNzcxUzMwNC41MTUsMTY4LjIyOSwyNTYsMTY4LjIyOXoiLz48cGF0aCBkPSJNNDM3LjA2MSw3NC45NEMzODguNzM1LDI2LjYxNSwzMjQuNDM0LDAsMjU2LDBTMTIzLjI2NSwyNi42MTUsNzQuOTM5LDc0Ljk0UzAsMTg3LjU2NiwwLDI1NnMyNi42MTQsMTMyLjczNSw3NC45MzksMTgxLjA2MQlTMTg3LjU2Niw1MTIsMjU2LDUxMnMxMzIuNzM1LTI2LjYxNCwxODEuMDYxLTc0LjkzOVM1MTIsMzI0LjQzNCw1MTIsMjU2UzQ4NS4zODYsMTIzLjI2Niw0MzcuMDYxLDc0Ljk0eiBNMjU2LDQ5MS4xMDIJQzEyNi4zNjUsNDkxLjEwMiwyMC44OTgsMzg1LjYzNSwyMC44OTgsMjU2UzEyNi4zNjUsMjAuODk4LDI1NiwyMC44OThTNDkxLjEwMiwxMjYuMzY1LDQ5MS4xMDIsMjU2UzM4NS42MzUsNDkxLjEwMiwyNTYsNDkxLjEwMnoiLz48cGF0aCBkPSJNMzU0LjIyLDI1NmMwLTU0LjE1OC00NC4wNjEtOTguMjItOTguMjItOTguMjJzLTk4LjIyLDQ0LjA2Mi05OC4yMiw5OC4yMnM0NC4wNjIsOTguMjIsOTguMjIsOTguMjIJUzM1NC4yMiwzMTAuMTU5LDM1NC4yMiwyNTZ6IE0xNzguNjc4LDI1NmMwLTQyLjYzNiwzNC42ODYtNzcuMzIyLDc3LjMyMi03Ny4zMjJzNzcuMzIyLDM0LjY4Niw3Ny4zMjIsNzcuMzIyCVMyOTguNjM2LDMzMy4zMjIsMjU2LDMzMy4zMjJTMTc4LjY3OCwyOTguNjM2LDE3OC42NzgsMjU2eiIvPjxwYXRoIGQ9Ik0yODUuMjU3LDI1NmMwLTE2LjEzMi0xMy4xMjQtMjkuMjU3LTI5LjI1Ny0yOS4yNTdTMjI2Ljc0MywyMzkuODY4LDIyNi43NDMsMjU2czEzLjEyNSwyOS4yNTcsMjkuMjU3LDI5LjI1NwlTMjg1LjI1NywyNzIuMTMzLDI4NS4yNTcsMjU2eiBNMjQ3LjY0MSwyNTZjMC00LjYwOSwzLjc1LTguMzU5LDguMzU5LTguMzU5YzQuNjA5LDAsOC4zNTksMy43NSw4LjM1OSw4LjM1OQljMCw0LjYwOS0zLjc1LDguMzU5LTguMzU5LDguMzU5QzI1MS4zOTEsMjY0LjM1OSwyNDcuNjQxLDI2MC42MDksMjQ3LjY0MSwyNTZ6Ii8+PHBhdGggZD0iTTI1NiwzOTEuODM3Yy01Ljc3MSwwLTEwLjQ0OSw0LjY3OC0xMC40NDksMTAuNDQ5YzAsNS43NzEsNC42NzgsMTAuNDQ5LDEwLjQ0OSwxMC40NDkJYzQxLjg5NywwLDgxLjI2NS0xNi4yOTQsMTEwLjg1My00NS44ODNjMjkuNTg3LTI5LjU4Nyw0NS44ODEtNjguOTU1LDQ1Ljg4MS0xMTAuODUyYzAtNS43NzEtNC42NzgtMTAuNDQ5LTEwLjQ0OS0xMC40NDkJYy01Ljc3MSwwLTEwLjQ0OSw0LjY3OC0xMC40NDksMTAuNDQ5QzM5MS44MzcsMzMwLjksMzMwLjksMzkxLjgzNywyNTYsMzkxLjgzN3oiLz48cGF0aCBkPSJNNDQ5LjMwNiwyNDUuNTUxYy01Ljc3MSwwLTEwLjQ0OSw0LjY3OC0xMC40NDksMTAuNDQ5YzAsMS40ODEtMC4wMTgsMi45NTgtMC4wNTIsNC40MwljLTAuMTM2LDUuNzY5LDQuNDMsMTAuNTU3LDEwLjE5OSwxMC42OTJjMC4wODUsMC4wMDIsMC4xNjgsMC4wMDMsMC4yNTIsMC4wMDNjNS42NTYsMCwxMC4zMDctNC41MTcsMTAuNDQyLTEwLjIwMgljMC4wMzktMS42MzcsMC4wNTktMy4yNzksMC4wNTktNC45MjVDNDU5Ljc1NSwyNTAuMjI5LDQ1NS4wNzcsMjQ1LjU1MSw0NDkuMzA2LDI0NS41NTF6Ii8+PHBhdGggZD0iTTQ0Ny41NSwyODQuMjM5Yy01LjY1Ni0xLjE0NS0xMS4xNjgsMi41Mi0xMi4zMDgsOC4xNzhDNDE4LjEzNSwzNzcuMjcxLDM0Mi43NTMsNDM4Ljg1NywyNTYsNDM4Ljg1NwljLTUuNzcxLDAtMTAuNDQ5LDQuNjc4LTEwLjQ0OSwxMC40NDljMCw1Ljc3MSw0LjY3OCwxMC40NDksMTAuNDQ5LDEwLjQ0OWM0Ny4zNTMsMCw5My40NjctMTYuNTczLDEyOS44NDctNDYuNjY4CWMzNS45LTI5LjY5Nyw2MC43MTctNzEuMDg0LDY5Ljg4MS0xMTYuNTRDNDU2Ljg2OCwyOTAuODkxLDQ1My4yMDcsMjg1LjM4LDQ0Ny41NSwyODQuMjM5eiIvPjxwYXRoIGQ9Ik0yNTYsMTIwLjE2M2M1Ljc3MSwwLDEwLjQ0OS00LjY3OCwxMC40NDktMTAuNDQ5UzI2MS43NzEsOTkuMjY1LDI1Niw5OS4yNjVjLTQxLjg5NywwLTgxLjI2NSwxNi4yOTQtMTEwLjg1Myw0NS44ODMJQzExNS41NTksMTc0LjczNSw5OS4yNjUsMjE0LjEwMyw5OS4yNjUsMjU2YzAsNS43NzEsNC42NzgsMTAuNDQ5LDEwLjQ0OSwxMC40NDlzMTAuNDQ5LTQuNjc4LDEwLjQ0OS0xMC40NDkJQzEyMC4xNjMsMTgxLjEsMTgxLjEsMTIwLjE2MywyNTYsMTIwLjE2M3oiLz48cGF0aCBkPSJNNjIuOTk2LDI0MC44NzZjLTUuNzU5LTAuMTQtMTAuNTU3LDQuNDMtMTAuNjkyLDEwLjE5OWMtMC4wMzksMS42MzctMC4wNTksMy4yNzktMC4wNTksNC45MjUJYzAsNS43NzEsNC42NzgsMTAuNDQ5LDEwLjQ0OSwxMC40NDlTNzMuMTQzLDI2MS43NzEsNzMuMTQzLDI1NmMwLTEuNDgxLDAuMDE4LTIuOTU4LDAuMDUyLTQuNDMJQzczLjMzMSwyNDUuOCw2OC43NjUsMjQxLjAxMyw2Mi45OTYsMjQwLjg3NnoiLz48cGF0aCBkPSJNMjU2LDczLjE0M2M1Ljc3MSwwLDEwLjQ0OS00LjY3OCwxMC40NDktMTAuNDQ5UzI2MS43NzEsNTIuMjQ1LDI1Niw1Mi4yNDVjLTQ3LjM1MywwLTkzLjQ2NywxNi41NzMtMTI5Ljg0Nyw0Ni42NjgJYy0zNS45LDI5LjY5Ny02MC43MTcsNzEuMDg0LTY5Ljg4MSwxMTYuNTRjLTEuMTQsNS42NTcsMi41MjEsMTEuMTY4LDguMTc4LDEyLjMwOGMwLjY5NywwLjE0MSwxLjM5MiwwLjIwOCwyLjA3NiwwLjIwOAljNC44NzIsMCw5LjIzMi0zLjQyNiwxMC4yMzItOC4zODZDOTMuODY0LDEzNC43MjksMTY5LjI0Nyw3My4xNDMsMjU2LDczLjE0M3oiLz48L3N2Zz4=","netease":"data:image/webp;base64,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","qq":"data:image/webp;base64,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","kugou":"data:image/webp;base64,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","kugouLite":"data:image/webp;base64,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"}

    function providerLogo(provider, size) {
      var src = PROVIDER_LOGOS[provider] || PROVIDER_LOGOS.netease
      return h('img', { className: 'mp-provider-logo', src: src, width: size || 20, height: size || 20, alt: '' })
    }

    // ── src/36-guide-shots.js
    // Real now-playing page screenshots used by the startup guide.
    var GUIDE_SHOT_SQUARE = 'data:image/webp;base64,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'
    var GUIDE_SHOT_VINYL = 'data:image/webp;base64,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'

    // ── src/40-eq.js
    /**
     * eq: ten-band graphic equalizer (data + pure math only).
     *
     * The audio graph lives in 50-player; this fragment owns the preset table, the
     * pref normalisation and the frequency-response math used by the editor curve.
     * Everything here is pure so `test/eq.test.mjs` can check it without Web Audio.
     *
     * Bands follow Winamp's ten-band layout because the factory presets below are
     * recorded at exactly these frequencies; switching to ISO spacing would mean
     * re-deriving every preset and losing the original curve.
     */

    /**
     * Bands and Q follow AutoEQ's fixed-band profile exactly
     * (31/62/125/250/500/1k/2k/4k/8k/16k Hz, Q=1.41). The device library ships
     * thousands of presets in that layout, so importing them is a straight copy —
     * no curve fitting, and 31 Hz stays available for in-ear bass correction.
     */
    var EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
    var EQ_Q = [1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41, 1.41]

    /**
     * Layout tag saved with the preferences. Bumped whenever EQ_FREQS changes so
     * bands stored by an older build are re-derived instead of misread.
     */
    var EQ_LAYOUT = 'iso10'

    /** Winamp's own ten bands, kept only as the source of the factory presets. */
    var WINAMP_FREQS = [70, 180, 320, 600, 1000, 3000, 6000, 12000, 14000, 16000]
    var WINAMP_Q = [1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 2, 3, 3]

    var EQ_MAX_DB = 12
    var EQ_PREAMP_MAX = 12
    /**
     * Cap on the automatic trim. Compensating the full boosted peak would make a
     * preset like Rock ~10 dB quieter than flat, which reads as a bug to users;
     * the output limiter in the player catches whatever the cap leaves over.
     */
    var EQ_HEADROOM_MAX = 6
    var EQ_CUSTOM_LIMIT = 20
    var EQ_CURVE_POINTS = 64
    var EQ_MIN_HZ = 20
    var EQ_MAX_HZ = 20000

    /**
     * Winamp's original factory presets: ten raw fader values (0..64, 33 = 0 dB)
     * plus a preamp fader. Values transcribed from
     * https://github.com/schollz/Winamp-Original-Presets (resources/Winamp.q1.json).
     */
    var EQ_PRESETS = [
      {
        id: 'flat',
        zh: '平直',
        en: 'Flat',
        values: [33, 33, 33, 33, 33, 33, 33, 33, 33, 33],
      },
      {
        id: 'pop',
        zh: '流行',
        en: 'Pop',
        values: [29, 40, 44, 45, 41, 30, 28, 28, 29, 29],
      },
      {
        id: 'rock',
        zh: '摇滚',
        en: 'Rock',
        values: [45, 40, 23, 19, 26, 39, 47, 50, 50, 50],
      },
      {
        id: 'softRock',
        zh: '轻摇滚',
        en: 'Soft rock',
        values: [39, 39, 36, 31, 25, 23, 26, 31, 37, 47],
      },
      {
        id: 'classical',
        zh: '古典',
        en: 'Classical',
        values: [33, 33, 33, 33, 33, 33, 20, 20, 20, 16],
      },
      {
        id: 'dance',
        zh: '舞曲',
        en: 'Dance',
        values: [48, 44, 36, 32, 32, 22, 20, 20, 32, 32],
      },
      {
        id: 'club',
        zh: '俱乐部',
        en: 'Club',
        values: [33, 33, 38, 42, 42, 42, 38, 33, 33, 33],
      },
      {
        id: 'party',
        zh: '派对',
        en: 'Party',
        values: [44, 44, 33, 33, 33, 33, 33, 33, 44, 44],
      },
      {
        id: 'live',
        zh: '现场',
        en: 'Live',
        values: [24, 33, 39, 41, 42, 42, 39, 37, 37, 36],
      },
      {
        id: 'largeHall',
        zh: '大厅',
        en: 'Large hall',
        values: [49, 49, 42, 42, 33, 24, 24, 24, 33, 33],
      },
      {
        id: 'reggae',
        zh: '雷鬼',
        en: 'Reggae',
        values: [33, 33, 31, 22, 33, 43, 43, 33, 33, 33],
      },
      {
        id: 'ska',
        zh: '斯卡',
        en: 'Ska',
        values: [28, 24, 25, 31, 39, 42, 47, 48, 50, 48],
      },
      {
        id: 'techno',
        zh: '电子',
        en: 'Techno',
        values: [45, 42, 33, 23, 24, 33, 45, 48, 48, 47],
      },
      {
        id: 'soft',
        zh: '柔和',
        en: 'Soft',
        values: [40, 35, 30, 28, 30, 39, 46, 48, 50, 52],
      },
      {
        id: 'fullBass',
        zh: '重低音',
        en: 'Full bass',
        values: [48, 48, 48, 42, 35, 25, 18, 15, 14, 14],
      },
      {
        id: 'fullTreble',
        zh: '高音增强',
        en: 'Full treble',
        values: [16, 16, 16, 25, 37, 50, 58, 58, 58, 60],
      },
      {
        id: 'fullBassTreble',
        zh: '高低音增强',
        en: 'Full bass + treble',
        values: [44, 42, 33, 20, 24, 35, 46, 50, 52, 52],
      },
      {
        id: 'laptop',
        zh: '笔记本 / 耳机',
        en: 'Laptop / headphones',
        values: [40, 50, 41, 26, 28, 35, 40, 48, 53, 56],
      },
    ]

    /** Display name for the current UI language. */
    function eqPresetName(preset) {
      if (!preset) return ''
      return LANG === 'zh' ? preset.zh || preset.en : preset.en || preset.zh
    }

    function eqPresetById(id) {
      var key = String(id || '')
      for (var index = 0; index < EQ_PRESETS.length; index += 1) {
        if (EQ_PRESETS[index].id === key) return EQ_PRESETS[index]
      }
      return null
    }

    /**
     * Winamp fader (0..64, 33 = 0 dB) to decibels. The scale is asymmetric around
     * the centre — 33 steps down, 31 steps up — so map each half separately to keep
     * both extremes at exactly ±12 dB.
     */
    function eqFaderToDb(value) {
      var raw = Number(value)
      if (!isFinite(raw)) return 0
      var fader = clamp(raw, 0, 64)
      var db = fader >= 33 ? ((fader - 33) / 31) * EQ_MAX_DB : ((fader - 33) / 33) * EQ_MAX_DB
      return clamp(db, -EQ_MAX_DB, EQ_MAX_DB)
    }

    /**
     * Re-derive a Winamp factory preset on the plugin's bands.
     *
     * The original faders sit at Winamp's frequencies, so the stored curve is built
     * from those filters and then sampled at the equalizer's own band centres. The
     * character survives; the numbers move because the grid moved.
     */
    function eqBandsForPreset(id) {
      var preset = eqPresetById(id)
      if (preset === null) return zeroEqBands()
      var sections = []
      for (var band = 0; band < WINAMP_FREQS.length; band += 1) {
        var db = eqFaderToDb(preset.values[band])
        if (Math.abs(db) < 0.01) continue
        sections.push(eqPeakingCoefficients(WINAMP_FREQS[band], WINAMP_Q[band], db, 44100))
      }
      if (sections.length === 0) return zeroEqBands()
      return EQ_FREQS.map(function (freq) {
        var sum = 0
        for (var index = 0; index < sections.length; index += 1) {
          sum += eqSectionDb(sections[index], freq, 44100)
        }
        return roundDecimals(clamp(sum, -EQ_MAX_DB, EQ_MAX_DB), 1)
      })
    }

    function zeroEqBands() {
      return EQ_FREQS.map(function () {
        return 0
      })
    }

    function roundDecimals(value, digits) {
      var factor = Math.pow(10, digits)
      return Math.round(value * factor) / factor
    }

    /** Coerce whatever localStorage held into ten finite decibel values. */
    function normalizeEqBands(list) {
      if (!Array.isArray(list)) return zeroEqBands()
      return EQ_FREQS.map(function (_, index) {
        var value = Number(list[index])
        if (!isFinite(value)) return 0
        // Tenths of a decibel: AutoEQ presets are published to one decimal place,
        // so integer rounding would move every imported curve by up to 0.5 dB.
        return roundDecimals(clamp(value, -EQ_MAX_DB, EQ_MAX_DB), 1)
      })
    }

    /**
     * Resolve the persisted preferences into a complete EQ state.
     *
     * `eqLayout` guards the band grid: bands saved by a build with different
     * frequencies would describe a different curve, so those are dropped and the
     * stored preset is re-derived instead of being misread. Missing fields keep the
     * EQ off, so upgrades never change how a playlist sounds.
     */
    function normalizeEqPrefs(prefs) {
      var source = prefs !== null && typeof prefs === 'object' ? prefs : {}
      var presetId = String(source.eqPreset || 'flat')
      var preset = eqPresetById(presetId)
      var isDevice = presetId === 'device'
      var sameLayout = source.eqLayout === EQ_LAYOUT
      var bands
      if (sameLayout && Array.isArray(source.eqBands)) {
        bands = normalizeEqBands(source.eqBands)
      } else {
        bands = preset === null ? zeroEqBands() : eqBandsForPreset(preset.id)
      }
      var savedPreset = isDevice
        ? 'device'
        : presetId === 'custom'
          ? 'custom'
          : preset === null
            ? 'flat'
            : preset.id
      return {
        enabled: source.eqEnabled === true,
        preset: savedPreset,
        bands: bands,
        preamp: Math.round(clamp(Number(source.eqPreamp) || 0, -EQ_PREAMP_MAX, EQ_PREAMP_MAX)),
        device: isDevice ? String(source.eqDevice || '') : '',
      }
    }

    /** True when the band layout matches a factory preset exactly. */
    function eqBandsMatchPreset(bands, presetId) {
      var target = eqBandsForPreset(presetId)
      var list = normalizeEqBands(bands)
      for (var index = 0; index < target.length; index += 1) {
        if (Math.abs(target[index] - list[index]) > 0.15) return false
      }
      return true
    }

    /** Which factory preset the given bands represent, or 'custom'. */
    function eqPresetForBands(bands) {
      for (var index = 0; index < EQ_PRESETS.length; index += 1) {
        if (eqBandsMatchPreset(bands, EQ_PRESETS[index].id)) return EQ_PRESETS[index].id
      }
      return 'custom'
    }

    /**
     * Peaking sections for the current bands, skipping anything a 0 dB band or the
     * Nyquist limit makes pointless.
     */
    function eqSections(bands, sampleRate) {
      var list = normalizeEqBands(bands)
      var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
      var sections = []
      for (var band = 0; band < EQ_FREQS.length; band += 1) {
        if (EQ_FREQS[band] >= rate / 2) continue
        if (Math.abs(list[band]) < 0.01) continue
        sections.push(eqPeakingCoefficients(EQ_FREQS[band], EQ_Q[band], list[band], rate))
      }
      return sections
    }

    /**
     * Loudest point of the boosted response. Adjacent bands overlap in phase, so
     * the true peak is above the largest single band; sampling the response keeps
     * the headroom honest instead of guessing from the fader values.
     */
    function eqPeakBoostDb(bands, sampleRate) {
      var sections = eqSections(bands, sampleRate)
      if (sections.length === 0) return 0
      var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
      var lowLog = Math.log(EQ_MIN_HZ)
      var highLog = Math.log(Math.min(EQ_MAX_HZ, rate / 2))
      var peak = 0
      for (var index = 0; index <= 48; index += 1) {
        var freq = Math.exp(lowLog + ((highLog - lowLog) * index) / 48)
        var db = 0
        for (var section = 0; section < sections.length; section += 1) {
          db += eqSectionDb(sections[section], freq, rate)
        }
        if (db > peak) peak = db
      }
      return peak
    }

    /**
     * Automatic headroom: trim by the boosted peak, capped at EQ_HEADROOM_MAX so a
     * heavy preset stays roughly as loud as flat. Never boosts, so switching the EQ
     * off and on cannot make the track louder.
     */
    function eqHeadroomDb(bands) {
      var peak = eqPeakBoostDb(bands, 44100)
      if (!(peak > 0)) return 0
      return -Math.min(roundDecimals(peak, 1), EQ_HEADROOM_MAX)
    }

    /** Total gain the preamp node should apply, including the headroom trim. */
    function eqTotalPreampDb(preamp, bands) {
      var value = clamp(Number(preamp) || 0, -EQ_PREAMP_MAX, EQ_PREAMP_MAX)
      return roundDecimals(value + eqHeadroomDb(bands), 2)
    }

    function eqDbToLinear(db) {
      return Math.pow(10, (Number(db) || 0) / 20)
    }

    /**
     * Peaking-filter coefficients, matching the Web Audio `BiquadFilterNode`
     * definition (RBJ audio EQ cookbook). Returned as [b0, b1, b2, a0, a1, a2].
     */
    function eqPeakingCoefficients(freq, q, gainDb, sampleRate) {
      var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
      var f0 = clamp(freq, 10, rate / 2 - 1)
      var amplitude = Math.pow(10, (Number(gainDb) || 0) / 40)
      var omega = (2 * Math.PI * f0) / rate
      var alpha = Math.sin(omega) / (2 * Math.max(0.0001, Number(q) || 1))
      var cos = Math.cos(omega)
      return [
        1 + alpha * amplitude,
        -2 * cos,
        1 - alpha * amplitude,
        1 + alpha / amplitude,
        -2 * cos,
        1 - alpha / amplitude,
      ]
    }

    /** |H(e^{jw})| for one biquad section, in decibels. */
    function eqSectionDb(coefficients, freq, sampleRate) {
      var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
      var omega = (2 * Math.PI * clamp(freq, 1, rate / 2)) / rate
      var cos1 = Math.cos(-omega)
      var sin1 = Math.sin(-omega)
      var cos2 = Math.cos(-2 * omega)
      var sin2 = Math.sin(-2 * omega)
      var numReal = coefficients[0] + coefficients[1] * cos1 + coefficients[2] * cos2
      var numImag = coefficients[1] * sin1 + coefficients[2] * sin2
      var denReal = coefficients[3] + coefficients[4] * cos1 + coefficients[5] * cos2
      var denImag = coefficients[4] * sin1 + coefficients[5] * sin2
      var numerator = Math.sqrt(numReal * numReal + numImag * numImag)
      var denominator = Math.sqrt(denReal * denReal + denImag * denImag)
      if (!(denominator > 0)) return 0
      return 20 * Math.log10(numerator / denominator)
    }

    /**
     * Sampled magnitude response of the whole chain (bands + preamp + headroom),
     * log-spaced across the audible range. Used to draw the editor curve.
     */
    function eqCurveSamples(bands, preampDb, count, sampleRate) {
      var list = normalizeEqBands(bands)
      var rate = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
      var points = Math.max(2, Math.floor(Number(count) || EQ_CURVE_POINTS))
      var sections = eqSections(list, rate)
      var total = eqTotalPreampDb(preampDb, list)
      var output = []
      var lowLog = Math.log(EQ_MIN_HZ)
      var highLog = Math.log(Math.min(EQ_MAX_HZ, rate / 2))
      for (var index = 0; index < points; index += 1) {
        var ratio = points === 1 ? 0 : index / (points - 1)
        var freq = Math.exp(lowLog + (highLog - lowLog) * ratio)
        var db = total
        for (var section = 0; section < sections.length; section += 1) {
          db += eqSectionDb(sections[section], freq, rate)
        }
        output.push({ freq: freq, db: db })
      }
      return output
    }

    /** Frequency marks drawn under the curve. */
    function eqCurveTicks() {
      return [70, 180, 320, 600, 1000, 3000, 6000, 12000, 16000]
    }

    // ── src/40-store.js
    /**
     * store: the smallest possible subscription store used by every view.
     *
     * No React context: views read a module-level store through `useStore`, which
     * keeps the panel a single tree and avoids provider plumbing.
     */

    function createStore(initial) {
      var state = initial
      var listeners = []
      return {
        get: function () {
          return state
        },
        set: function (patch) {
          var next = typeof patch === 'function' ? patch(state) : Object.assign({}, state, patch)
          if (next === state) return state
          state = next
          listeners.slice().forEach(function (fn) {
            try {
              fn(state)
            } catch (error) {
              // A broken listener must not stop the others.
            }
          })
          return state
        },
        subscribe: function (fn) {
          listeners.push(fn)
          return function () {
            var at = listeners.indexOf(fn)
            if (at >= 0) listeners.splice(at, 1)
          }
        },
      }
    }

    function useStore(store) {
      var pair = useState(store.get())
      var state = pair[0]
      var setState = pair[1]
      useEffect(
        function () {
          setState(store.get())
          return store.subscribe(setState)
        },
        [store],
      )
      return state
    }

    // ── src/45-crossfade.js
    /**
     * crossfade: decisions only (the two-deck machinery lives in 50-player).
     *
     * The goal is one switch, like a "smart transition": the engine analyses how
     * the current track ends and how the next one begins, then picks both the cut
     * point and the overlap length itself. Loudness is the signal we can measure
     * cheaply and reliably — no beat grid, no segment model.
     */

    var CROSSFADE_MAX_SECONDS = 6
    var CROSSFADE_MIN_SECONDS = 2.5
    /** Start analysing this early; analysis is fast but the fetch is not. */
    var CROSSFADE_PREPARE_SECONDS = 14
    /** Only a genuinely silent intro is skipped, and never more than this. */
    var CROSSFADE_INTRO_SKIP_SECONDS = 2
    var CROSSFADE_SKIP_LIMIT_SECONDS = 10
    /**
     * How long the incoming track is actually audible. The overlap may be longer
     * when the outgoing track has a quiet tail — the outgoing fade uses that whole
     * tail, but the next track only rises during the last few seconds, so it never
     * "starts singing" long before the hand-over.
     */
    var CROSSFADE_INCOMING_SECONDS = 2.5

    /** 0 means off. The stored value is the upper bound of the automatic overlap. */
    function crossfadeFadeSeconds(prefs) {
      var value = Number(prefs !== null && typeof prefs === 'object' ? prefs.crossfadeSeconds : 0)
      if (!isFinite(value) || value <= 0) return 0
      return Math.min(CROSSFADE_MAX_SECONDS, Math.max(CROSSFADE_MIN_SECONDS, value))
    }

    /** Same album (and same album artist when both sides have one). */
    function crossfadeSameAlbum(current, next) {
      if (!current || !next) return false
      var album = String(current.album || '').trim().toLowerCase()
      var nextAlbum = String(next.album || '').trim().toLowerCase()
      if (album === '' || album !== nextAlbum) return false
      var artist = String(current.albumArtist || current.artist || '').trim().toLowerCase()
      var nextArtist = String(next.albumArtist || next.artist || '').trim().toLowerCase()
      return artist === '' || nextArtist === '' || artist === nextArtist
    }

    /**
     * Whether the pair may be blended at all. Consecutive tracks from one album
     * keep their original join: albums are authored as continuous works (live
     * records, DJ mixes, concept albums) and blending them smears the artist's
     * transition. This is fixed behaviour, not a setting.
     */
    function crossfadeNextAllowed(prefs, current, next) {
      if (!current || !next) return false
      if (String(current.path) === String(next.path)) return false
      if (crossfadeSameAlbum(current, next)) return false
      return true
    }

    /**
     * Decide the blend from the two measured envelopes.
     *
     * `current.outroQuietSec` is how long the outgoing track has been quiet at its
     * end (0 when it ends loud), `next.introQuietSec` the same at the start of the
     * incoming one. We fade through the quiet tail; if there is none we still
     * overlap a minimum amount instead of hard-cutting. A long silent intro is
     * skipped so the new track is already audible when the old one stops.
     */
    function crossfadePlan(current, next, options) {
      var settings = options !== null && typeof options === 'object' ? options : {}
      var limit = crossfadeFadeSeconds(settings.prefs)
      if (limit <= 0) return null
      var remaining = Number(settings.remaining)
      if (!isFinite(remaining) || remaining <= 0) return null
      var max = Math.min(limit, Math.max(CROSSFADE_MIN_SECONDS, remaining))
      var tail = Number(current && current.outroQuietSec)
      var silentIntro = Number(next && next.introSilentSec)
      if (!isFinite(tail) || tail < 0) tail = 0
      if (!isFinite(silentIntro) || silentIntro < 0) silentIntro = 0
      var overlap = tail > 0.4 ? tail : CROSSFADE_MIN_SECONDS
      overlap = Math.max(CROSSFADE_MIN_SECONDS, Math.min(overlap, max))
      // Skipping is reserved for actual silence: a soft musical intro is content,
      // and cutting into it makes the next track start mid-phrase.
      var startInNext =
        silentIntro >= CROSSFADE_INTRO_SKIP_SECONDS
          ? Math.max(0, Math.min(silentIntro - 0.5, CROSSFADE_SKIP_LIMIT_SECONDS))
          : 0
      return {
        overlap: Math.round(overlap * 10) / 10,
        startInNext: Math.round(startInNext * 10) / 10,
      }
    }

    /**
     * Pure gate used by the player on every timeupdate: are we close enough to the
     * end to start analysing?
     */
    function crossfadeShouldStart(input) {
      var s = input !== null && typeof input === 'object' ? input : {}
      if (crossfadeFadeSeconds(s.prefs) <= 0) return false
      if (s.playing !== true) return false
      if (s.hasGraph !== true) return false
      if (s.loop === 'one') return false
      var index = Number(s.index)
      var queueLength = Number(s.queueLength)
      if (!(index >= 0) || !(queueLength > 1)) return false
      if (s.loop === 'none' && index >= queueLength - 1) return false
      var duration = Number(s.duration)
      var time = Number(s.currentTime)
      if (!(duration > 0) || !(time >= 0)) return false
      var remaining = duration - time
      if (remaining > CROSSFADE_PREPARE_SECONDS) return false
      // Too close to the end to build anything that finishes inside the track.
      if (remaining <= 0.5) return false
      return true
    }

    /** Split an overlap into "outgoing only" + "both audible" segments. */
    function crossfadeIncomingWindow(overlap) {
      var total = Math.max(0, Number(overlap) || 0)
      var window = Math.min(total, CROSSFADE_INCOMING_SECONDS)
      return { window: Math.round(window * 10) / 10, delay: Math.round((total - window) * 10) / 10 }
    }

    /** Equal-power pair for N+1 curve points (cos falls, sin rises). */
    function crossfadeEqualPowerCurves(steps) {
      var points = Math.max(2, Math.floor(Number(steps) || 32)) + 1
      var out = new Float32Array(points)
      var incoming = new Float32Array(points)
      for (var index = 0; index < points; index += 1) {
        var ratio = index / (points - 1)
        out[index] = Math.cos((ratio * Math.PI) / 2)
        incoming[index] = Math.sin((ratio * Math.PI) / 2)
      }
      return { out: out, incoming: incoming }
    }

    // ── src/46-transition.js
    /**
     * transition analysis: how a track starts and ends, measured from its samples.
     *
     * Deliberately narrow: we only need to know how many seconds at the beginning
     * and at the end sit well below the track's own average level. That is enough
     * to choose a crossfade point and length without pretending to understand the
     * music (no beat grid, no segment model).
     */

    /** Window/hop for the level envelope (seconds). */
    var TRANSITION_WINDOW = 0.1
    var TRANSITION_HOP = 0.05
    /** Only the first/last stretches can contain the transition. */
    var TRANSITION_HEAD = 20
    var TRANSITION_TAIL = 30
    /** "Quiet" means this far below the track's own average level. */
    var TRANSITION_QUIET_DB = -10
    /**
     * "Silent" is absolute: only a genuinely empty intro may be skipped. A soft
     * musical intro is often 10 dB below the average, and skipping that would cut
     * real music off the front of the next track.
     */
    var TRANSITION_SILENT_DB = -45

    function transitionRmsDb(channels, start, length, weight) {
      var sum = 0
      var samples = 0
      for (var channel = 0; channel < channels.length; channel += 1) {
        var data = channels[channel]
        var end = Math.min(start + length, data.length)
        var energy = 0
        for (var index = start; index < end; index += 1) energy += data[index] * data[index]
        sum += (weight && weight[channel] ? weight[channel] : 1) * energy
        samples += Math.max(0, end - start)
      }
      if (samples <= 0) return -Infinity
      var mean = sum / samples
      if (!(mean > 0)) return -Infinity
      return 10 * Math.log10(mean)
    }

    /**
     * @param {Float32Array[]} channels
     * @param {number} sampleRate
     * @returns {{ duration: number, loudnessDb: number, introQuietSec: number, outroQuietSec: number } | null}
     */
    function analyzeTransitionEnvelope(channels, sampleRate) {
      if (!Array.isArray(channels) || channels.length === 0) return null
      var rate = Number(sampleRate)
      if (!(rate > 0)) return null
      var length = channels[0].length
      if (!(length > 0)) return null
      var duration = length / rate
      var windowSize = Math.max(1, Math.round(TRANSITION_WINDOW * rate))
      var hop = Math.max(1, Math.round(TRANSITION_HOP * rate))

      // Average level over the whole file, sampled sparsely: enough to anchor the
      // quiet threshold without walking every sample.
      var overallSum = 0
      var overallCount = 0
      for (var channel = 0; channel < channels.length; channel += 1) {
        var data = channels[channel]
        for (var index = 0; index < data.length; index += 16) {
          overallSum += data[index] * data[index]
          overallCount += 1
        }
      }
      var loudnessDb = overallCount > 0 && overallSum > 0 ? 10 * Math.log10(overallSum / overallCount) : -Infinity
      var quietThreshold = loudnessDb + TRANSITION_QUIET_DB

      function windowDb(start) {
        return transitionRmsDb(channels, start, windowSize, null)
      }

      var headLimit = Math.min(length, Math.round(TRANSITION_HEAD * rate))
      var tailStart = Math.max(0, length - Math.round(TRANSITION_TAIL * rate))

      function round(value) {
        return Math.round(Math.max(0, value) * 10) / 10
      }

      // A file with no measurable level at all (silence, or a decode that produced
      // zeros): every edge counts as quiet, so let the caller clamp it.
      if (!isFinite(loudnessDb)) {
        return {
          duration: round(duration),
          loudnessDb: -70,
          introQuietSec: round(headLimit / rate),
          introSilentSec: round(headLimit / rate),
          outroQuietSec: round((length - tailStart) / rate),
        }
      }

      // Intro: walk forward from 0 until a window is no longer quiet. The silent
      // measurement is stricter and is the only one allowed to skip audio.
      var introQuietSec = headLimit / rate
      var introSilentSec = headLimit / rate
      var quietEnded = false
      var silentEnded = false
      for (var start = 0; start + windowSize <= headLimit; start += hop) {
        var level = windowDb(start)
        if (!quietEnded && level >= quietThreshold) {
          introQuietSec = start / rate
          quietEnded = true
        }
        if (!silentEnded && level >= TRANSITION_SILENT_DB) {
          introSilentSec = start / rate
          silentEnded = true
        }
        if (quietEnded && silentEnded) break
      }

      // Outro: walk backwards from the end until a window is loud again.
      var outroQuietSec = (length - tailStart) / rate
      for (var back = length - windowSize; back >= tailStart; back -= hop) {
        if (windowDb(back) >= quietThreshold) {
          outroQuietSec = (length - (back + windowSize)) / rate
          break
        }
      }

      return {
        duration: round(duration),
        loudnessDb: Math.round(loudnessDb * 10) / 10,
        introQuietSec: round(introQuietSec),
        introSilentSec: round(introSilentSec),
        outroQuietSec: round(outroQuietSec),
      }
    }

    /** Same analysis straight from a decoded AudioBuffer. */
    function analyzeTransitionBuffer(buffer) {
      if (!buffer || typeof buffer.getChannelData !== 'function') return null
      var channels = []
      for (var index = 0; index < buffer.numberOfChannels; index += 1) {
        channels.push(buffer.getChannelData(index))
      }
      return analyzeTransitionEnvelope(channels, buffer.sampleRate)
    }

    // ── src/45-ui.js
    /**
     * ui state: source, section, filter, query and the two panel-level toggles.
     *
     * Persisted subset: source / nav / playlistId (localStorage `music.ui.v2`),
     * migrated once from the 0.11 keys `mu.source` and `mu.view`.
     */

    var UI_KEY = 'music.ui.v2'
    var LEGACY_UI_KEYS = ['mu.source', 'mu.view']

    /** Every selectable playback source, in tab order. */
    var UI_SOURCES = ['local', 'netease', 'qq', 'kugou', 'kugouLite', 'navidrome']

    // Derived from UI_SOURCES so the list only exists once: a second hardcoded copy
    // is exactly how `music_control`'s source whitelist drifted and started
    // treating navidrome as a local search.
    function isOnlineSource(source) {
      if (source === 'local') return false
      return UI_SOURCES.indexOf(String(source || '')) >= 0
    }

    function sourceLabelOf(source) {
      if (source === 'netease') return t('online.providerNetease')
      if (source === 'qq') return t('online.providerQq')
      if (source === 'kugou') return t('online.providerKugou')
      if (source === 'kugouLite') return t('online.providerKugouLite')
      if (source === 'navidrome') return t('online.providerNavidrome')
      return t('page.tabLocal')
    }

    function rawStorageGet(key, fallback) {
      try {
        var value = window.localStorage.getItem(key)
        return value === null || value === undefined ? fallback : String(value)
      } catch (error) {
        return fallback
      }
    }

    function readUiState() {
      var saved = storageGet(UI_KEY, null)
      if (saved === null || typeof saved !== 'object') {
        // Migrate the 0.11 keys once so the panel opens where it was left.
        var legacySource = rawStorageGet(LEGACY_UI_KEYS[0], '')
        var legacyView = rawStorageGet(LEGACY_UI_KEYS[1], '')
        var source = UI_SOURCES.indexOf(legacySource) >= 0 ? legacySource : 'local'
        var nav = 'songs'
        if (source !== 'local') nav = 'recent'
        else if (['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'stats'].indexOf(legacyView) >= 0) {
          nav = legacyView
        }
        return { source: source, nav: nav, playlistId: '' }
      }
      var source = UI_SOURCES.indexOf(saved.source) >= 0 ? saved.source : 'local'
      var nav = typeof saved.nav === 'string' && saved.nav !== '' ? saved.nav : 'songs'
      var playlistId = typeof saved.playlistId === 'string' ? saved.playlistId : ''
      if (nav === 'playlists') nav = source === 'local' ? 'songs' : 'recent'
      if (nav === 'playlist' && (source !== 'local' || playlistId === '')) nav = source === 'local' ? 'songs' : 'recent'
      // `artist` is this branch's own view: it needs a provider artist id that only
      // lives in memory, so a reload cannot restore it and would query with an empty
      // id. Fall back to the artist list it was opened from. The album view is left
      // to upstream's handling — reloading there behaves as it did before.
      if (nav === 'artist') nav = source === 'local' ? 'songs' : 'artists'
      if (nav === 'artistSongs') nav = source === 'local' ? 'songs' : 'recent'
      return { source: source, nav: nav, playlistId: playlistId }
    }

    var uiStore = createStore(
      Object.assign(
        {
          filter: null,
          query: '',
          queueOpen: false,
          queueSource: '',
          npOpen: false,
        },
        readUiState(),
      ),
    )

    function setUi(patch) {
      return uiStore.set(patch)
    }

    function isLocalNav(nav) {
      return ['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'playlist', 'stats'].indexOf(nav) >= 0
    }

    /** Section groups for the current source (rail or top bar). */
    /** Online playlist ordering is local-only; the platform order is kept as "source". */
    function onlinePlaylistSortMode() {
      var mode = prefsStore.get().onlinePlaylistSort
      return mode === 'name' || mode === 'count' ? mode : 'source'
    }

    function onlinePlaylistSortLabel(mode) {
      if (mode === 'name') return t('v2.sortName')
      if (mode === 'count') return t('v2.sortCount')
      return t('v2.sortSource')
    }

    function sortOnlinePlaylists(list) {
      var mode = onlinePlaylistSortMode()
      var copy = (list || []).slice()
      if (mode === 'name') {
        copy.sort(function (left, right) {
          return String(left.name || '').localeCompare(String(right.name || ''), 'zh')
        })
      } else if (mode === 'count') {
        copy.sort(function (left, right) {
          var delta = (Number(right.trackCount) || 0) - (Number(left.trackCount) || 0)
          return delta !== 0
            ? delta
            : String(left.name || '').localeCompare(String(right.name || ''), 'zh')
        })
      }
      return copy
    }

    function cycleOnlinePlaylistSort() {
      var mode = onlinePlaylistSortMode()
      var next = mode === 'source' ? 'name' : mode === 'name' ? 'count' : 'source'
      setPrefs({ onlinePlaylistSort: next })
    }

    function navGroupsFor(source, favoritesCount) {
      var library = libraryStore.get()
      if (isOnlineSource(source)) {
        var online = onlineStore.get()
        var playlists = sortOnlinePlaylists(online.playlists || [])
        var signedIn = (online.providers[source] || {}).loggedIn === true
        // Navidrome can enumerate a whole library, so it gets the same browse shape
        // as the local library — songs, artists, albums. Artist and album rows open
        // the shared album view, so these are navigation surfaces only. The Chinese
        // platforms are search-only and get none of them.
        var browse =
          source === 'navidrome'
            ? [
                { key: 'songs', label: t('v2.songs'), icon: 'note', count: null },
                { key: 'artists', label: t('v2.artists'), icon: 'user', count: null },
                { key: 'albums', label: t('v2.albums'), icon: 'disc', count: null },
              ]
            : []
        var groups = [
          {
            label: t('v2.sectionOnline'),
            items: browse.concat([
              { key: 'recent', label: t('v2.recent'), icon: 'clock', count: null },
              { key: 'cache', label: t('v2.cache'), icon: 'download', count: null },
            ]),
          },
        ]
        if (signedIn) {
          groups.push({
            label: t('v2.playlists'),
            showLabel: true,
            action: {
              icon: 'sort',
              title: t('v2.playlistSort') + ': ' + onlinePlaylistSortLabel(onlinePlaylistSortMode()),
              run: cycleOnlinePlaylistSort,
            },
            items: playlists.map(function (playlist) {
              return {
                key: 'online-playlist:' + playlist.id,
                label: playlist.name || '',
                icon: 'list',
                count: playlist.trackCount || 0,
                coverSrc: playlist.cover ? onlineCoverSrc({ coverUrl: playlist.cover }) : '',
                onlinePlaylist: playlist,
              }
            }),
          })
        }
        return groups
      }
      return [
        {
          label: t('v2.sectionLibrary'),
          items: [
            { key: 'songs', label: t('v2.songs'), icon: 'note', count: library.tracks.length },
            { key: 'albums', label: t('v2.albums'), icon: 'disc', count: null },
            { key: 'artists', label: t('v2.artists'), icon: 'user', count: null },
            { key: 'folders', label: t('v2.folders'), icon: 'folder', count: null },
          ],
        },
        {
          label: t('v2.sectionCollection'),
          items: [
            { key: 'favorites', label: t('v2.favorites'), icon: 'heart', count: favoritesCount },
            { key: 'stats', label: t('v2.stats'), icon: 'chart', count: null },
          ],
        },
        {
          label: t('v2.playlists'),
          showLabel: true,
          action: {
            icon: 'plus',
            title: t('v2.newPlaylist'),
            run: function () {
              pushLayer('newPlaylist')
            },
          },
          items: (library.playlists || []).map(function (playlist) {
            return {
              key: 'local-playlist:' + playlist.id,
              label: playlist.name || '',
              icon: 'list',
              count: (playlist.trackPaths || []).length,
              coverSrc: trackCoverSrc(playlistTracks(playlist)[0] || null),
              localPlaylistId: playlist.id,
              playlist: playlist,
            }
          }),
        },
      ]
    }

    /** One click path for every nav shape: plain sections, local/online playlists. */
    function activateNavItem(item) {
      if (item.localPlaylistId) {
        openLocalPlaylist(item.localPlaylistId)
        return
      }
      if (item.onlinePlaylist) {
        void openOnlinePlaylist(item.onlinePlaylist)
        setNav('playlist')
        return
      }
      setNav(item.key)
    }

    function activeNavKey(nav) {
      var ui = uiStore.get()
      if (nav === 'playlist') {
        if (isOnlineSource(ui.source)) return 'online-playlist:' + (onlineStore.get().playlistId || '')
        return 'local-playlist:' + (ui.playlistId || '')
      }
      return nav
    }

    function sectionTitleOf(ui) {
      switch (ui.nav) {
        case 'songs':
          return t('v2.allSongs')
        case 'albums':
          return t('v2.albums')
        case 'artists':
          return t('v2.artists')
        case 'folders':
          return t('v2.folders')
        case 'favorites':
          return t('v2.favorites')
        case 'playlists':
          return t('v2.playlists')
        case 'playlist':
          return (playlistById(ui.playlistId) || {}).name || t('v2.playlists')
        case 'stats':
          return t('v2.stats')
        case 'recent':
          return t('v2.recent')
        case 'album':
          return onlineStore.get().albumName || t('online.album')
        case 'cache':
          return t('v2.cache')
        default:
          return t('v2.songs')
      }
    }

    function setSource(source) {
      var ui = uiStore.get()
      if (ui.source === source) return
      selectionStore.set({ active: false, paths: [] })
      artistLoadToken = (artistLoadToken || 0) + 1
      uiStore.set({
        source: source,
        // Navidrome opens on the library list; the Chinese platforms are
        // search-driven and have nothing to show until the user types.
        nav: !isOnlineSource(source) ? 'songs' : source === 'navidrome' ? 'songs' : 'recent',
        filter: null,
        query: '',
        playlistId: '',
      })
      onlineStore.set({
        provider: isOnlineSource(source) ? source : onlineStore.get().provider,
        playlists: [],
        playlistsPhase: 'idle',
        playlistsProvider: '',
        liked: {},
        playlistId: '',
        playlistName: '',
        playlistSongs: [],
        playlistPhase: 'idle',
        artistName: '',
        artistProvider: '',
        artistFrom: '',
        artistSongs: [],
        artistPhase: 'idle',
        artistError: '',
        query: '',
        results: [],
        searchPage: 1,
        searchTotal: 0,
        searchLoadingMore: false,
        phase: 'idle',
        error: '',
      })
      if (isOnlineSource(source)) void loadProviders()
    }

    function setNav(nav) {
      selectionStore.set({ active: false, paths: [] })
      uiStore.set({ nav: nav, filter: null, playlistId: nav === 'playlist' ? uiStore.get().playlistId : '' })
    }

    function openLocalPlaylist(id) {
      selectionStore.set({ active: false, paths: [] })
      uiStore.set({ nav: 'playlist', playlistId: id, filter: null, query: '' })
    }

    function openOnlineSection(nav) {
      closeOnlinePlaylist()
      uiStore.set({ nav: nav, filter: null })
    }

    uiStore.subscribe(function (state) {
      storageSet(UI_KEY, {
        source: state.source,
        nav: state.nav,
        playlistId: state.playlistId,
      })
    })

    // ── src/50-player.js
    /**
     * playback engine moved verbatim from 0.11.1. It relies on the helpers in 10-base / 20-api / 30-prefs keeping their names.
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */

    function shuffleTracks(list, currentTrack) {
      var queue = list.slice()
      for (var j = queue.length - 1; j > 0; j -= 1) {
        var k = Math.floor(Math.random() * (j + 1))
        var tmp = queue[j]
        queue[j] = queue[k]
        queue[k] = tmp
      }
      if (currentTrack) {
        var at = queue.indexOf(currentTrack)
        if (at > 0) {
          queue.splice(at, 1)
          queue.unshift(currentTrack)
        }
      }
      return queue
    }

    // Three playback modes, mapped onto the engine's loop/order pair:
    //   sequence → in order, stop at the end
    //   random   → shuffled, looping
    //   one      → repeat the current track
    var PLAY_MODES = ['sequence', 'random', 'one']

    function playModeOf(snap) {
      if (snap.loop === 'one') return 'one'
      if (snap.order === 'random') return 'random'
      return 'sequence'
    }

    function playModeLabel(mode) {
      return mode === 'one'
        ? t('page.modeOne')
        : mode === 'random'
          ? t('page.modeRandom')
          : t('page.modeSequence')
    }

    function playModeIcon(mode) {
      return mode === 'one' ? 'repeatOne' : mode === 'random' ? 'shuffle' : 'repeat'
    }

    function applyPlayMode(mode) {
      if (mode === 'one') {
        player.setLoop('one')
        player.setOrder('list')
        return
      }
      if (mode === 'random') {
        player.setLoop('all')
        player.setOrder('random')
        return
      }
      player.setLoop('none')
      player.setOrder('list')
    }

    function cyclePlayMode(snap) {
      var current = playModeOf(snap)
      applyPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(current) + 1) % PLAY_MODES.length])
    }

    function nextIndexOf(index, size) {
      if (size <= 1) return 0
      return (index + 1) % size
    }

    function prevIndexOf(index, size) {
      if (size <= 1) return 0
      return (index - 1 + size) % size
    }

    // ── playback engine (module-level: survives panel unmount) ───────────
    // The <audio> element lives here rather than in the React tree, so
    // selecting another main panel keeps the current track playing.

    function sameQueue(left, right) {
      if (left.length !== right.length) return false
      for (var i = 0; i < left.length; i += 1) {
        if (!right[i] || left[i].path !== right[i].path) return false
      }
      return true
    }

    // One engine per page. Client modules can be re-executed by HMR or by a
    // module-table rebuild; a second engine would own a second <audio> and
    // play on top of the first. Every execution reuses the same instance.
    var PLAYER_KEY = '__dshMusicPlayer'

    /**
     * Playback engine, one per page.
     *
     * The <audio> element is owned by the `shell.overlay` seat (a resident
     * floating layer) and handed in through `attachAudio`. That keeps the
     * element inside the document — browsers treat detached media elements
     * differently for background playback, system media keys and autoplay —
     * while this engine stays the single source of playback state.
     */
    function createPlayer() {
      if (typeof window !== 'undefined' && window[PLAYER_KEY]) return window[PLAYER_KEY]
      var prefs = readPrefs()
      var audio = null
      /**
       * Second element used only for the incoming side of a crossfade. The active
       * deck is always the one in `audio`; the two swap roles when a fade lands, so
       * everything below keeps talking about "the current element".
       */
      var audioB = null
      var deckSource = null
      var deckSourceB = null
      var fadeNode = null
      var fadeNodeB = null
      var trimNode = null
      var trimNodeB = null
      var secondaryWired = false
      var objectUrlB = null
      var normalizeGainB = 1
      /** Crossfade controller: token cancels stale fetches, timer lands the swap. */
      var xfadeToken = 0
      var xfadeActive = false
      var xfadePending = false
      var xfadeAdopted = false
      var xfadeTimer = null
      var xfadeAdoptTimer = null
      var xfadeNext = -1
      /** Blob of the track on the active deck, kept for the tail analysis. */
      var currentBlob = null
      /** Measured plan + fetched audio for the incoming side. */
      var xfadePrepared = null
      /** Background download of the next track, so an uncached online song is ready. */
      var prefetchedNext = null
      var prefetchAbort = null
      var prefetchToken = 0
      /** Web Audio graph used by the bar visualizer (lazy, user-gesture bound). */
      var audioContext = null
      var analyser = null
      var gainNode = null
      /** Preamp stage in front of the EQ chain (0 dB when the EQ is off). */
      var preampNode = null
      /** Safety limiter after the EQ: heavy boosts must not clip the DAC. */
      var limiterNode = null
      /** `[{ band, node }]` — bands above Nyquist are skipped, so keep the mapping. */
      var eqNodes = []
      /** Resolved EQ settings; persisted through prefs on every change. */
      var eq = normalizeEqPrefs(prefs)
      var waveData = null
      var normalizeGain = 1
      var loudnessToken = 0
      /** Resolves when the current track's gain is ready (or analysis gave up). */
      var loudnessGate = null
      /** Active `blob:` URL for the loaded track (local media seeks reliably). */
      var objectUrl = null
      var currentLoudnessBlob = null
      /** In-flight track download. */
      var fetchAbort = null
      /** Bumped per load so a stale download cannot overwrite a newer track. */
      var loadToken = 0
      var pendingAutoplay = false
      var listeners = []
      var timeListeners = []
      var errorListeners = []
      var errorStreak = 0
      var state = {
        queue: [],
        index: -1,
        playing: false,
        loop: prefs.loop === 'one' ? 'one' : 'none',
        order: prefs.order === 'random' && prefs.loop !== 'one' ? 'random' : 'list',
        // Volume follows the system mixer: the plugin no longer exposes its own.
        volume: 1,
        muted: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
      }

      // ── resume + listening statistics ───────────────────────────────────
      // Counting follows the Last.fm / MusicBee rule (half the track or four
      // minutes, whichever comes first); resume follows the NetEase / Spotify
      // pattern (restore the queue and position, then stay paused). The clock
      // only counts time that naturally advanced while playing, so dragging
      // the seek bar never inflates the statistics.
      var session = { path: '', seconds: 0, pending: 0, lastTime: 0, counted: false }
      var lastStateSave = 0
      var restoreAttempted = false
      var pendingResumeSeconds = null
      /** Only the tab holding the player lock may produce sound / write stats. */
      var leader = true
      var leaderTimer = null
      var tabId = 'music-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
      var LEADER_KEY = 'dsh-music-panel.player.leader'

      function resetSession(item) {
        session = {
          path: item ? item.path : '',
          seconds: 0,
          pending: 0,
          lastTime: 0,
          counted: false,
        }
      }

      function durationOf(item) {
        if (audio !== null && isFinite(audio.duration) && audio.duration > 0) return audio.duration
        return item && item.durationSec > 0 ? item.durationSec : 0
      }

      function recordStatsPlay(item) {
        try {
          postJson(API + 'play', { path: item.path }).catch(function () {})
        } catch (error) {
          // Statistics never block playback.
        }
      }

      /** Flush the seconds that have not been reported yet (>= 30s only). */
      function flushListening(force) {
        if (session.path === '' || session.pending <= 0) return
        if (session.seconds < 30) {
          if (force) session.pending = 0
          return
        }
        var seconds = session.pending
        session.pending = 0
        try {
          postJson(API + 'playback', { path: session.path, seconds: seconds }).catch(function () {})
        } catch (error) {
          // Best effort.
        }
      }

      function flushSessionPosition() {
        if (session.path === '' || readPrefs().rememberPerTrack !== true) return
        var item = currentItem()
        if (item === null || item.path !== session.path) return
        var seconds = state.currentTime
        if (!(seconds > 0)) return
        try {
          postJson(API + 'position', { path: session.path, seconds: seconds }).catch(function () {})
        } catch (error) {
          // Best effort.
        }
      }

      function playbackTrackSnapshot(track) {
        return {
          path: track.path,
          title: trackTitleOf(track),
          artist: trackArtistOf(track),
          album: track.album || '',
          durationSec: Number(track.durationSec) || 0,
          coverUrl: track.coverUrl || '',
          hasCover: track.hasCover === true,
          // Self-hosted artwork is addressed by id; persisting it keeps the
          // restored queue's covers intact.
          coverArtId: track.coverArtId || '',
          onlineProvider: track.onlineProvider || '',
          onlineId: track.onlineId || '',
          qualityHint: track.qualityHint || '',
        }
      }

      function savePlaybackState() {
        if (!leader) return
        var item = currentItem()
        if (item === null) return
        var duration = state.duration > 0 ? state.duration : item.durationSec || 0
        // Keep the saved queue bounded (playback.json caps at 500): store a
        // window around the current track so restore never picks the wrong one.
        var queueItems = state.queue.map(playbackTrackSnapshot)
        var index = state.index
        if (queueItems.length > 500) {
          var start = Math.max(0, Math.min(index - 250, queueItems.length - 500))
          queueItems = queueItems.slice(start, start + 500)
          index -= start
        }
        try {
          postJson(API + 'state', {
            queue: queueItems,
            index: index,
            positionSec: state.currentTime,
            durationSec: duration,
            loop: state.loop,
            order: state.order,
          }).catch(function () {})
        } catch (error) {
          // Best effort.
        }
      }

      function trackListening() {
        if (audio === null) return
        var item = currentItem()
        if (item === null) return
        if (session.path !== item.path) resetSession(item)

        var current = audio.currentTime
        if (state.playing && !audio.paused) {
          var delta = current - session.lastTime
          // A seek produces a large or negative jump; only natural playback
          // advances count toward listening time.
          if (delta > 0 && delta <= 3) {
            session.seconds += delta
            session.pending += delta
          }
        }
        session.lastTime = current

        var duration = durationOf(item)
        var threshold = playThresholdOf(duration)
        if (!session.counted && duration > 30 && session.seconds >= threshold) {
          session.counted = true
          recordStatsPlay(item)
        }

        if (session.seconds >= 30 && session.pending >= 10) flushListening(false)

        var now = Date.now()
        if (now - lastStateSave >= 5000) {
          lastStateSave = now
          savePlaybackState()
        }
      }

      function trackFromSaved(entry, byPath) {
        if (typeof entry === 'string') return byPath[entry] || null
        if (entry === null || typeof entry !== 'object') return null
        if (entry.onlineProvider && entry.onlineId) {
          return {
            path: entry.path || 'online:' + entry.onlineProvider + ':' + entry.onlineId,
            title: entry.title || '',
            artist: entry.artist || '',
            album: entry.album || '',
            durationSec: Number(entry.durationSec) || 0,
            hasCover: entry.hasCover === true,
            coverUrl: entry.coverUrl || '',
            coverArtId: entry.coverArtId || '',
            onlineUrl: onlineStreamUrl(entry.onlineProvider, entry.onlineId),
            onlineProvider: entry.onlineProvider,
            onlineId: entry.onlineId,
            qualityHint: entry.qualityHint || '',
            sampleRate: 0,
            size: 0,
            mtime: 0,
          }
        }
        return byPath[entry.path] || null
      }

      function restorePlayback(saved, tracks) {
        if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return false
        var byPath = {}
        ;(Array.isArray(tracks) ? tracks : []).forEach(function (track) {
          byPath[track.path] = track
        })
        var queue = []
        saved.queue.forEach(function (entry) {
          var track = trackFromSaved(entry, byPath)
          if (track !== null && typeof track.path === 'string' && track.path !== '') queue.push(track)
        })
        if (queue.length === 0) return false
        var wanted = saved.queue[saved.index]
        var wantedPath = typeof wanted === 'string' ? wanted : wanted && wanted.path ? wanted.path : ''
        var index = 0
        for (var i = 0; i < queue.length; i += 1) {
          if (wantedPath !== '' && queue[i].path === wantedPath) {
            index = i
            break
          }
        }
        state = Object.assign({}, state, {
          queue: queue,
          index: index,
          loop: saved.loop === 'one' ? 'one' : saved.order === 'random' ? 'all' : 'none',
          order: saved.order === 'random' && saved.loop !== 'one' ? 'random' : 'list',
          currentTime: saved.positionSec > 0 ? saved.positionSec : 0,
          duration: saved.durationSec > 0 ? saved.durationSec : 0,
          playing: false,
        })
        emit()
        syncMediaSession()
        resetSession(queue[index])
        pendingResumeSeconds = saved.positionSec > 0 ? saved.positionSec : null
        // Paused by default (NetEase/Spotify behaviour); the setting can ask
        // for playback to start right after restore.
        load(index, readPrefs().autoResume === true)
        return true
      }

      function tryRestore() {
        if (restoreAttempted) return
        restoreAttempted = true
        if (readPrefs().resumeOnStart !== true) return
        Promise.all([getJson(API + 'state'), getJson(API + 'library')])
          .then(function (results) {
            var saved = results[0] !== null && results[0].state !== undefined ? results[0].state : null
            var tracks = results[1] !== null && Array.isArray(results[1].tracks) ? results[1].tracks : []
            restorePlayback(saved, tracks)
          })
          .catch(function () {
            // Resume is best effort.
          })
      }

      function flushOnHide() {
        flushListening(true)
        flushSessionPosition()
        savePlaybackState()
      }

      function emit() {
        listeners.forEach(function (fn) {
          fn()
        })
        timeListeners.forEach(function (fn) {
          fn()
        })
      }

      function emitTime() {
        timeListeners.forEach(function (fn) {
          fn()
        })
      }

      function patch(next) {
        state = Object.assign({}, state, next)
        emit()
      }

      function currentItem() {
        return state.index >= 0 && state.queue[state.index] ? state.queue[state.index] : null
      }

      // ── media session (system media keys, lock screen, OS media panel) ──

      function syncMediaSession() {
        if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
        var item = currentItem()
        try {
          if (item === null) {
            navigator.mediaSession.metadata = null
          } else if (typeof MediaMetadata !== 'undefined') {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: item.title,
              artist: item.artist || '',
              album: item.album || '',
              artwork: item.hasCover
                ? [{ src: new URL(coverUrl(item.path), window.location.href).href, sizes: '512x512' }]
                : [],
            })
          }
          if (typeof navigator.mediaSession.setPlaybackState === 'function') {
            navigator.mediaSession.setPlaybackState(state.playing ? 'playing' : 'paused')
          }
        } catch (error) {
          // Media Session is best effort.
        }
      }

      function syncMediaHandlers() {
        if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
        try {
          navigator.mediaSession.setActionHandler('play', function () {
            api.play()
          })
          navigator.mediaSession.setActionHandler('pause', function () {
            api.pause()
          })
          navigator.mediaSession.setActionHandler('previoustrack', function () {
            api.prev()
          })
          navigator.mediaSession.setActionHandler('nexttrack', function () {
            api.next()
          })
          navigator.mediaSession.setActionHandler('seekto', function (details) {
            if (details && typeof details.seekTime === 'number') api.seek(details.seekTime)
          })
        } catch (error) {
          // Older browsers expose a partial action list.
        }
      }

      // ── audio element wiring ───────────────────────────────────────────

      /**
       * Events from the spare deck must not touch state. Handlers receive the
       * Event when registered and a plain reason string when called internally.
       */
      function isActiveEvent(event) {
        return event === null || event === undefined || !event.target || event.target === audio
      }

      function onTime(event) {
        if (!isActiveEvent(event)) return
        if (audio === null) return
        state = Object.assign({}, state, { currentTime: audio.currentTime })
        emitTime()
        trackListening()
        maybeCrossfade()
      }

      function onDuration(event) {
        if (!isActiveEvent(event)) return
        if (audio === null) return
        state = Object.assign({}, state, { duration: isFinite(audio.duration) ? audio.duration : 0 })
        emitTime()
      }

      function onProgress(event) {
        if (!isActiveEvent(event)) return
        if (audio === null) return
        if (audio.buffered && audio.buffered.length > 0) {
          state = Object.assign({}, state, {
            buffered: audio.buffered.end(audio.buffered.length - 1),
          })
          emitTime()
        }
      }

      function onPlaying(event) {
        if (!isActiveEvent(event)) return
        errorStreak = 0
      }

      function onPlay(event) {
        if (!isActiveEvent(event)) return
        if (!state.playing) {
          patch({ playing: true })
          syncMediaSession()
        }
        // Warm the next online track while this one plays (crossfade only).
        maybePrefetchNext()
      }

      function onPause(event) {
        if (!isActiveEvent(event)) return
        flushListening(true)
        flushSessionPosition()
        savePlaybackState()
        if (state.playing) {
          patch({ playing: false })
          syncMediaSession()
        }
      }

      function onEnded(event) {
        if (!isActiveEvent(event)) return
        flushListening(true)
        flushSessionPosition()
        if (state.queue.length === 0) return
        if (state.loop === 'one') {
          resetSession(currentItem())
          if (audio) {
            audio.currentTime = 0
            audio.play().catch(function () {})
          }
          return
        }
        if (state.loop === 'none' && state.index >= state.queue.length - 1) {
          patch({ playing: false })
          return
        }
        load(nextIndexOf(state.index, state.queue.length), true)
      }

      function onError(eventOrReason) {
        if (
          eventOrReason !== null &&
          typeof eventOrReason === 'object' &&
          eventOrReason.target &&
          eventOrReason.target !== audio
        ) {
          return
        }
        var reason =
          typeof eventOrReason === 'string'
            ? eventOrReason
            : eventOrReason && typeof eventOrReason.message === 'string'
              ? eventOrReason.message
              : ''
        errorStreak += 1
        var failedTrack = state.queue[state.index] || null
        errorListeners.forEach(function (fn) {
          try {
            fn({ track: failedTrack, streak: errorStreak, reason: reason || '' })
          } catch {
            /* a listener must never break playback */
          }
        })
        if (errorStreak > 3 || state.queue.length <= 1) {
          errorStreak = 0
          patch({ playing: false })
          return
        }
        load(nextIndexOf(state.index, state.queue.length), true)
      }

      function bind(el) {
        el.addEventListener('timeupdate', onTime)
        el.addEventListener('durationchange', onDuration)
        el.addEventListener('loadedmetadata', onDuration)
        el.addEventListener('progress', onProgress)
        el.addEventListener('canplay', onProgress)
        el.addEventListener('playing', onPlaying)
        el.addEventListener('play', onPlay)
        el.addEventListener('pause', onPause)
        el.addEventListener('ended', onEnded)
        el.addEventListener('error', onError)
      }

      function unbind(el) {
        el.removeEventListener('timeupdate', onTime)
        el.removeEventListener('durationchange', onDuration)
        el.removeEventListener('loadedmetadata', onDuration)
        el.removeEventListener('progress', onProgress)
        el.removeEventListener('canplay', onProgress)
        el.removeEventListener('playing', onPlaying)
        el.removeEventListener('play', onPlay)
        el.removeEventListener('pause', onPause)
        el.removeEventListener('ended', onEnded)
        el.removeEventListener('error', onError)
      }

      function releaseObjectUrl() {
        if (objectUrl === null) return
        try {
          URL.revokeObjectURL(objectUrl)
        } catch (error) {
          // Revoking twice is harmless.
        }
        objectUrl = null
      }

      function cancelPendingFetch() {
        if (fetchAbort === null) return
        try {
          fetchAbort.abort()
        } catch (error) {
          // Already settled.
        }
        fetchAbort = null
      }

      /**
       * Load one track through a local Blob URL.
       *
       * Playing from `blob:` is deliberate: on the Desktop (Electron) media
       * stack, writes to `currentTime` on this plugin's HTTP stream are
       * silently dropped while readyState is already 4, so seeking restarted
       * the track. A Blob is local media and seeks reliably. The download is a
       * loopback request, so it costs one disk read, not a network hop.
       */
      /** Element volume when normalization is applied without a Web Audio graph. */
      function effectiveVolume() {
        var trim = gainNode === null ? Math.min(1, normalizeGain) : 1
        return clamp(state.volume * trim, 0, 1)
      }

      function applyOutputVolume() {
        if (audio) audio.volume = effectiveVolume()
        if (audioB) audioB.volume = effectiveVolume()
      }

      /** Push a linear gain into one deck's trim node (short ramp while playing). */
      function applyTrimGain(node, linear, paused) {
        if (node === null || audioContext === null) return
        try {
          var now = audioContext.currentTime
          node.gain.cancelScheduledValues(now)
          if (paused) node.gain.setValueAtTime(linear, now)
          else node.gain.setTargetAtTime(linear, now, 0.12)
        } catch (error) {
          node.gain.value = linear
        }
      }

      function applyNormalizeGain(linear) {
        normalizeGain = Number.isFinite(linear) && linear > 0 ? linear : 1
        if (trimNode !== null && audioContext !== null) {
          // Before playback starts the gain must already be at its target;
          // otherwise the first seconds ramp down audibly. While a track is
          // playing, keep the short ramp so toggling normalization is smooth.
          applyTrimGain(trimNode, normalizeGain, audio === null || audio.paused === true)
        } else {
          applyOutputVolume()
        }
      }

      /**
       * Routing a cross-origin media element through Web Audio silences it: the
       * browser has no CORS grant, so the graph only outputs zeros. The plugin
       * normally plays blobs (same-origin), but the stream fallback assigns a
       * remote URL, and one media element can only enter Web Audio once.
       */
      function canRouteThroughWebAudio(el) {
        var source = ''
        try {
          source = String(el.currentSrc || el.src || '')
        } catch (error) {
          source = ''
        }
        if (source === '') return true
        if (source.indexOf('blob:') === 0 || source.indexOf('data:') === 0) return true
        try {
          return new URL(source, window.location.href).origin === window.location.origin
        } catch (error) {
          return false
        }
      }

      function buildEqNodes(context) {
        var nodes = []
        for (var band = 0; band < EQ_FREQS.length; band += 1) {
          // A band at or above Nyquist cannot be realised; skip it and keep going.
          if (EQ_FREQS[band] >= context.sampleRate / 2) continue
          var filter = context.createBiquadFilter()
          filter.type = 'peaking'
          filter.frequency.value = EQ_FREQS[band]
          filter.Q.value = EQ_Q[band]
          filter.gain.value = 0
          nodes.push({ band: band, node: filter })
        }
        return nodes
      }

      /**
       * Push the current EQ settings into the live graph. Disabled means every
       * band at 0 dB and no preamp, i.e. an actual bypass rather than "flat preset".
       */
      function applyEq(immediate) {
        var bands = eq.enabled ? eq.bands : zeroEqBands()
        var preampDb = eq.enabled ? eqTotalPreampDb(eq.preamp, bands) : 0
        var linear = eqDbToLinear(preampDb)
        var paused = audio === null || audio.paused === true || immediate === true
        if (preampNode !== null && audioContext !== null) {
          try {
            var now = audioContext.currentTime
            preampNode.gain.cancelScheduledValues(now)
            if (paused) preampNode.gain.setValueAtTime(linear, now)
            else preampNode.gain.setTargetAtTime(linear, now, 0.02)
          } catch (error) {
            preampNode.gain.value = linear
          }
        }
        for (var index = 0; index < eqNodes.length; index += 1) {
          var entry = eqNodes[index]
          var target = bands[entry.band]
          try {
            var time = audioContext === null ? 0 : audioContext.currentTime
            entry.node.gain.cancelScheduledValues(time)
            if (paused) entry.node.gain.setValueAtTime(target, time)
            else entry.node.gain.setTargetAtTime(target, time, 0.02)
          } catch (error) {
            entry.node.gain.value = target
          }
        }
      }

      /** Web Audio is the whole mechanism; without it the panel must say so. */
      function eqSupported() {
        return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
      }

      function createLoudnessGate() {
        var resolveGate = null
        var promise = new Promise(function (resolve) {
          resolveGate = resolve
        })
        loudnessGate = promise
        return {
          promise: promise,
          resolve: function () {
            if (resolveGate !== null) {
              var finish = resolveGate
              resolveGate = null
              finish()
            }
          },
        }
      }

      function playAfterLoudness(token) {
        var gate = loudnessGate === null ? Promise.resolve() : loudnessGate
        gate.then(function () {
          if (token !== loadToken || pendingAutoplay !== true || audio === null) return
          pendingAutoplay = false
          var context = api.ensureAnalyser()
          if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
            audioContext.resume().catch(function () {
              // If the context cannot start, leave the media element untouched.
            })
          }
          audio.play().catch(function () {
            // Autoplay may still be blocked; the play event will update the UI.
          })
        })
      }

      /** Analyse the downloaded blob in-browser and apply the per-track gain. */
      function scheduleLoudness(item, blob, done) {
        var token = (loudnessToken += 1)
        currentLoudnessBlob = blob || null
        applyNormalizeGain(1)
        var finish = typeof done === 'function' ? done : function () {}
        if (readPrefs().normalizeVolume === false || !item || !blob) {
          finish()
          return
        }
        analyzeLoudnessBlob(
          item,
          blob,
          function () {
            return token === loudnessToken
          },
          function (gainDb) {
            if (token !== loudnessToken) return
            applyNormalizeGain(Math.pow(10, clamp(gainDb, -15, 6) / 20))
          },
        )
          .then(function (gainDb) {
            if (token === loudnessToken && (gainDb === null || gainDb === undefined)) {
              applyNormalizeGain(1)
            }
          })
          .catch(function () {
            if (token === loudnessToken) applyNormalizeGain(1)
          })
          .then(function () {
            finish()
          })
      }

      function load(at, autoplay) {
        var item = state.queue[at]
        if (!item) return
        abortCrossfade()
        cancelPrefetch()
        currentBlob = null
        // Close the previous listening session before switching tracks.
        flushListening(true)
        flushSessionPosition()
        var token = (loadToken += 1)
        state = Object.assign({}, state, { index: at, currentTime: 0, duration: 0, buffered: 0 })
        emit()
        syncMediaSession()
        pendingAutoplay = autoplay === true
        // A new session starts here. The play count is recorded later, and
        // only when the Last.fm / MusicBee threshold is reached.
        resetSession(item)
        currentLoudnessBlob = null
        loudnessToken += 1
        applyNormalizeGain(1)
        var loudness = createLoudnessGate()
        if (audio === null) {
          loudness.resolve()
          return
        }
        if (autoplay === true) {
          var visualizerContext = api.ensureAnalyser()
          if (visualizerContext !== null && audioContext !== null && audioContext.state === 'suspended') {
            audioContext.resume().catch(function () {
              // The visualizer simply stays flat if the context cannot start.
            })
          }
        }

        cancelPendingFetch()
        // Online providers stream through the Host. The Desktop media stack
        // silently drops `currentTime` writes on this HTTP stream (seeking
        // restarted the track), so download the file first — when it is cached
        // this is a local read — and play from a blob like local tracks.
        if (typeof item.onlineUrl === 'string' && item.onlineUrl !== '') {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
          releaseObjectUrl()
          var onlineToken = token
          var onlineController =
            typeof AbortController !== 'undefined' ? new AbortController() : null
          fetchAbort = onlineController
          if (item.onlineProvider && item.onlineId) {
            void postJson(API + 'online/cache/meta', {
              provider: item.onlineProvider,
              id: item.onlineId,
              title: item.title || '',
              artist: item.artist || '',
              album: item.album || '',
              coverUrl: item.coverUrl || '',
              durationSec: item.durationSec || 0,
              vip: item.qualityHint === 'VIP',
            }).catch(function () {})
          }
          fetch(item.onlineUrl, onlineController === null ? {} : { signal: onlineController.signal })
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status)
              return response.blob()
            })
            .then(function (blob) {
              if (onlineToken !== loadToken) {
                loudness.resolve()
                return
              }
              fetchAbort = null
              if (audio === null) {
                loudness.resolve()
                return
              }
              releaseObjectUrl()
              objectUrl = URL.createObjectURL(blob)
              currentBlob = blob
              audio.src = objectUrl
              audio.load()
              scheduleLoudness(item, blob, loudness.resolve)
              if (pendingAutoplay) playAfterLoudness(token)
            })
            .catch(function () {
              if (onlineToken !== loadToken) {
                loudness.resolve()
                return
              }
              fetchAbort = null
              // The gate must open even when analysis is impossible: this path
              // streams without a blob and therefore has no gain to apply.
              loudness.resolve()
              if (audio === null) return
              // Streaming fallback: playback still starts even if the prefetch
              // failed (seeking may be less reliable in this rare path).
              audio.src = item.onlineUrl
              audio.load()
              if (pendingAutoplay) playAfterLoudness(token)
            })
          return
        }
        // Detach the old blob before revoking it: a revoked URL still
        // assigned to the element fires a spurious `error`.
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        releaseObjectUrl()
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        fetchAbort = controller

        fetch(streamUrl(item.path), controller === null ? {} : { signal: controller.signal })
          .then(function (response) {
            if (response.ok) return response.blob()
            return response
              .json()
              .catch(function () {
                return null
              })
              .then(function (body) {
                var reason =
                  body && body.error && typeof body.error.message === 'string' ? body.error.message : ''
                throw new Error(reason || 'HTTP ' + response.status)
              })
          })
          .then(function (blob) {
            if (token !== loadToken) {
              loudness.resolve()
              return
            }
            fetchAbort = null
            if (audio === null) {
              loudness.resolve()
              return
            }
            releaseObjectUrl()
            objectUrl = URL.createObjectURL(blob)
            currentBlob = blob
            audio.src = objectUrl
            audio.load()
            scheduleLoudness(item, blob, loudness.resolve)
            if (pendingResumeSeconds !== null) {
              var resumeAt = pendingResumeSeconds
              pendingResumeSeconds = null
              api.seek(resumeAt)
            } else if (readPrefs().rememberPerTrack === true) {
              getJson(API + 'position?path=' + encodeURIComponent(item.path))
                .then(function (body) {
                  if (token !== loadToken) return
                  var seconds = Number(body.lastPositionSec)
                  if (isFinite(seconds) && seconds > 1) api.seek(seconds)
                })
                .catch(function () {})
            }
            if (pendingAutoplay) playAfterLoudness(token)
          })
          .catch(function (error) {
            if (token !== loadToken) {
              loudness.resolve()
              return
            }
            fetchAbort = null
            loudness.resolve()
            if (error && error.name === 'AbortError') return
            onError(error && typeof error.message === 'string' ? error.message : '')
          })
      }

      // ── crossfade: two decks, equal-power overlap ───────────────────────
      //
      // The outgoing track keeps playing on the active element while the incoming
      // track starts on the spare one. When the fade lands, the two decks swap
      // roles, so every other part of the engine keeps working with `audio` and
      // `normalizeGain`.

      function ensureSecondary() {
        if (audio === null || audioB !== null) return
        var doc = audio.ownerDocument || (typeof document !== 'undefined' ? document : null)
        if (doc === null || typeof doc.createElement !== 'function') return
        audioB = doc.createElement('audio')
        audioB.preload = 'metadata'
        audioB.setAttribute('aria-hidden', 'true')
        audioB.className = 'mp-audio-host'
        if (audio.parentNode) audio.parentNode.insertBefore(audioB, audio.nextSibling)
        bind(audioB)
        audioB.volume = effectiveVolume()
        audioB.muted = state.muted
      }

      /** Build the spare deck's source/fade/trim nodes once the graph exists. */
      function wireSecondary() {
        if (secondaryWired) return
        if (audioB === null || audioContext === null || preampNode === null) return
        try {
          deckSourceB = audioContext.createMediaElementSource(audioB)
          fadeNodeB = audioContext.createGain()
          fadeNodeB.gain.value = 0
          trimNodeB = audioContext.createGain()
          trimNodeB.gain.value = normalizeGainB
          deckSourceB.connect(fadeNodeB)
          fadeNodeB.connect(trimNodeB)
          trimNodeB.connect(preampNode)
          secondaryWired = true
        } catch (error) {
          // A media element can only be bound once; leave crossfade disabled.
          secondaryWired = false
        }
      }

      function releaseObjectUrlB() {
        if (objectUrlB === null) return
        try {
          URL.revokeObjectURL(objectUrlB)
        } catch (error) {
          // Revoking twice is harmless.
        }
        objectUrlB = null
      }

      function releasePrefetched() {
        prefetchedNext = null
      }

      function cancelPrefetch() {
        prefetchToken += 1
        prefetchedNext = null
        if (prefetchAbort !== null) {
          try {
            prefetchAbort.abort()
          } catch (error) {
            // Already settled.
          }
          prefetchAbort = null
        }
      }

      /**
       * Warm the next online track while the current one plays. The 14 s prepare
       * window is not enough for a first-time download of a large file, so start
       * early instead of at the end; cached tracks make this a no-op.
       */
      function maybePrefetchNext() {
        if (xfadeActive || xfadePending || xfadePrepared !== null) return
        var settings = readPrefs()
        if (crossfadeFadeSeconds(settings) <= 0) return
        if (state.index < 0 || state.queue.length < 2) return
        var next = nextIndexOf(state.index, state.queue.length)
        if (next === state.index) return
        var item = state.queue[next]
        if (!item || typeof item.onlineUrl !== 'string' || item.onlineUrl === '') return
        if (!crossfadeNextAllowed(settings, currentItem(), item)) return
        if (prefetchedNext !== null && prefetchedNext.path === item.path) return
        if (prefetchAbort !== null) return
        var token = prefetchToken
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        prefetchAbort = controller
        var itemPath = item.path
        fetchTrackBlob(item, controller === null ? null : controller.signal)
          .then(function (blob) {
            if (token !== prefetchToken) return
            prefetchAbort = null
            // One track of memory at most; bigger files rely on the Host cache.
            prefetchedNext =
              blob.size > 80 * 1024 * 1024 ? null : { path: itemPath, blob: blob }
          })
          .catch(function () {
            if (token === prefetchToken) prefetchAbort = null
          })
      }

      /** Fetch one track the same way `load()` does, without touching the decks. */
      function fetchTrackBlob(item, signal) {
        var options = signal === undefined || signal === null ? {} : { signal: signal }
        if (typeof item.onlineUrl === 'string' && item.onlineUrl !== '') {
          return fetch(item.onlineUrl, options).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.blob()
          })
        }
        return fetch(streamUrl(item.path), options).then(function (response) {
          if (response.ok) return response.blob()
          return response
            .json()
            .catch(function () {
              return null
            })
            .then(function (body) {
              var reason = body && body.error && typeof body.error.message === 'string' ? body.error.message : ''
              throw new Error(reason || 'HTTP ' + response.status)
            })
        })
      }

      function decodeBlob(blob) {
        var decoder = loudnessContext()
        if (decoder === null) return Promise.reject(new Error('no audio decoder'))
        return blob.arrayBuffer().then(function (bytes) {
          return decoder.decodeAudioData(bytes)
        })
      }

      /**
       * Decode once and return what the transition needs: the level envelope and,
       * for the incoming deck, its loudness trim.
       */
      function analyzeTransitionBlob(blob, wantTrim) {
        return decodeBlob(blob).then(function (buffer) {
          var envelope = analyzeTransitionBuffer(buffer)
          if (!wantTrim) return { envelope: envelope, trim: 1 }
          return lufsFromAudioBuffer(buffer)
            .then(function (lufs) {
              var gainDb = clamp(LOUDNESS_TARGET - lufs, -15, 6)
              return { envelope: envelope, trim: Math.pow(10, gainDb / 20) }
            })
            .catch(function () {
              return { envelope: envelope, trim: 1 }
            })
        })
      }

      /** Phase one: measure both sides while there is still time to fetch B. */
      function prepareCrossfade(nextAt) {
        var item = state.queue[nextAt]
        if (!item || audio === null || analyser === null) return
        var token = (xfadeToken += 1)
        xfadePending = true
        xfadeNext = nextAt
        var outgoingBlob = currentBlob
        var wantTrim = readPrefs().normalizeVolume !== false
        var nextBlob = null
        var cachedBlob = prefetchedNext !== null && prefetchedNext.path === item.path ? prefetchedNext.blob : null
        Promise.all([
          outgoingBlob
            ? analyzeTransitionBlob(outgoingBlob, false)
                .then(function (result) {
                  return result.envelope
                })
                .catch(function () {
                  return null
                })
            : Promise.resolve(null),
          (cachedBlob !== null
            ? Promise.resolve(cachedBlob)
            : fetchTrackBlob(item)
          )
            .then(function (blob) {
              nextBlob = blob
              return analyzeTransitionBlob(blob, wantTrim)
            })
            .catch(function () {
              return null
            }),
        ]).then(function (results) {
          if (token !== xfadeToken || audio === null) return
          var incoming = results[1]
          if (nextBlob === null || incoming === null) {
            abortCrossfade()
            return
          }
          // The prefetched blob now lives in the prepared plan.
          releasePrefetched()
          var duration = state.duration > 0 ? state.duration : isFinite(audio.duration) ? audio.duration : 0
          var plan = crossfadePlan(
            { outroQuietSec: results[0] ? results[0].outroQuietSec : 0 },
            { introQuietSec: incoming.envelope ? incoming.envelope.introQuietSec : 0 },
            { prefs: readPrefs(), remaining: duration - audio.currentTime },
          )
          if (plan === null) {
            abortCrossfade()
            return
          }
          xfadePrepared = {
            nextAt: nextAt,
            plan: plan,
            blob: nextBlob,
            trim: incoming.trim,
            duration: incoming.envelope ? incoming.envelope.duration : 0,
          }
          xfadePending = false
          maybeCrossfade()
        })
      }

      function maybeCrossfade() {
        if (xfadeActive || audio === null || analyser === null || audioContext === null) return
        var settings = readPrefs()
        if (crossfadeFadeSeconds(settings) <= 0) {
          abortCrossfade()
          return
        }
        var duration = state.duration > 0 ? state.duration : isFinite(audio.duration) ? audio.duration : 0
        var remaining = duration - audio.currentTime
        if (xfadePrepared !== null) {
          if (remaining <= xfadePrepared.plan.overlap + 0.25) {
            if (remaining > 0.35) beginCrossfadePlayback(xfadePrepared)
            else abortCrossfade()
          }
          return
        }
        if (xfadePending) return
        if (state.index < 0 || state.queue.length < 2) return
        var next = nextIndexOf(state.index, state.queue.length)
        if (next < 0 || next === state.index) return
        if (!crossfadeNextAllowed(settings, currentItem(), state.queue[next])) return
        var should = crossfadeShouldStart({
          prefs: settings,
          playing: state.playing,
          hasGraph: true,
          loop: state.loop,
          index: state.index,
          queueLength: state.queue.length,
          duration: duration,
          currentTime: audio.currentTime,
        })
        if (!should) return
        prepareCrossfade(next)
      }

      function beginCrossfadePlayback(prepared) {
        if (prepared === null || prepared === undefined) return abortCrossfade()
        ensureSecondary()
        if (audioB === null || audioContext === null || fadeNode === null) return abortCrossfade()
        wireSecondary()
        if (!secondaryWired || fadeNodeB === null || trimNodeB === null) return abortCrossfade()
        var remaining = (state.duration > 0 ? state.duration : audio.duration || 0) - audio.currentTime
        var fade = Math.min(prepared.plan.overlap, remaining - 0.05)
        if (!(fade >= 1)) return abortCrossfade()
        var token = xfadeToken
        releaseObjectUrlB()
        objectUrlB = URL.createObjectURL(prepared.blob)
        normalizeGainB = prepared.trim
        audioB.volume = effectiveVolume()
        audioB.muted = state.muted
        audioB.src = objectUrlB
        audioB.load()
        try {
          audioB.currentTime = prepared.plan.startInNext
        } catch (error) {
          // Older engines refuse a seek before metadata; start from zero then.
        }
        var now = audioContext.currentTime
        trimNodeB.gain.setValueAtTime(prepared.trim, now)
        fadeNodeB.gain.cancelScheduledValues(now)
        fadeNodeB.gain.setValueAtTime(0, now)
        fadeNode.gain.cancelScheduledValues(now)
        fadeNode.gain.setValueAtTime(1, now)
        var started
        try {
          started = audioB.play()
        } catch (error) {
          return abortCrossfade()
        }
        Promise.resolve(started)
          .then(function () {
            if (token !== xfadeToken || audioContext === null || audio === null) return
            var at = audioContext.currentTime
            var curves = crossfadeEqualPowerCurves(32)
            // The outgoing track fades across the whole overlap, but the incoming
            // one only rises during its last few seconds: the next song must not be
            // singing a long time before the hand-over.
            var blend = crossfadeIncomingWindow(fade)
            fadeNode.gain.cancelScheduledValues(at)
            fadeNode.gain.setValueAtTime(1, at)
            fadeNode.gain.setValueCurveAtTime(curves.out, at, fade)
            fadeNodeB.gain.cancelScheduledValues(at)
            fadeNodeB.gain.setValueAtTime(0, at)
            if (blend.delay > 0.02) fadeNodeB.gain.setValueAtTime(0, at + blend.delay)
            fadeNodeB.gain.setValueCurveAtTime(curves.incoming, at + blend.delay, blend.window)
            xfadeActive = true
            xfadePending = false
            // The UI switches when the incoming track becomes audible, not when the
            // (possibly silent) overlap starts.
            if (xfadeAdoptTimer !== null) clearTimeout(xfadeAdoptTimer)
            if (blend.delay > 0.05) {
              xfadeAdoptTimer = setTimeout(function () {
                xfadeAdoptTimer = null
                adoptIncoming(token)
              }, blend.delay * 1000)
            } else {
              xfadeAdoptTimer = null
              adoptIncoming(token)
            }
            if (xfadeTimer !== null) clearTimeout(xfadeTimer)
            xfadeTimer = setTimeout(function () {
              xfadeTimer = null
              finishCrossfade(token)
            }, Math.max(200, fade * 1000 - 40))
          })
          .catch(function () {
            if (token === xfadeToken) abortCrossfade()
          })
      }

      function swapDecks() {
        var element = audio
        audio = audioB
        audioB = element
        var source = deckSource
        deckSource = deckSourceB
        deckSourceB = source
        var fade = fadeNode
        fadeNode = fadeNodeB
        fadeNodeB = fade
        var trim = trimNode
        trimNode = trimNodeB
        trimNodeB = trim
        var url = objectUrl
        objectUrl = objectUrlB
        objectUrlB = url
        var loudness = normalizeGain
        normalizeGain = normalizeGainB
        normalizeGainB = loudness
      }

      /**
       * The fade has started, so the incoming deck is already audible: switch the
       * UI and every track-bound piece of state to it at once. The outgoing
       * element keeps playing (and fading) as a ghost until the curve lands.
       */
      function adoptIncoming(token) {
        if (token !== xfadeToken || xfadeAdopted) return
        var prepared = xfadePrepared
        if (prepared === null || audio === null || audioB === null) return abortCrossfade()
        var nextAt = prepared.nextAt
        if (nextAt < 0 || !state.queue[nextAt]) return abortCrossfade()
        flushListening(true)
        flushSessionPosition()
        swapDecks()
        var item = state.queue[nextAt]
        var duration = prepared.duration > 0 ? prepared.duration : item.durationSec > 0 ? item.durationSec : 0
        state = Object.assign({}, state, {
          index: nextAt,
          currentTime: audio.currentTime || 0,
          duration: duration,
          buffered: 0,
          playing: true,
        })
        currentBlob = prepared.blob
        currentLoudnessBlob = prepared.blob
        xfadePrepared = null
        xfadeAdopted = true
        xfadeNext = -1
        resetSession(item)
        session.lastTime = audio.currentTime || 0
        syncMediaSession()
        applyOutputVolume()
        emit()
        savePlaybackState()
        maybePrefetchNext()
      }

      /** The overlap is over: silence and release the outgoing element. */
      function finishCrossfade(token) {
        if (token !== xfadeToken) return
        if (xfadeAdoptTimer !== null) {
          clearTimeout(xfadeAdoptTimer)
          xfadeAdoptTimer = null
        }
        // Timers can race under throttling; never leave the UI on the ghost.
        if (!xfadeAdopted && xfadePrepared !== null) adoptIncoming(token)
        xfadeActive = false
        xfadePending = false
        xfadeAdopted = false
        if (audioContext !== null) {
          var now = audioContext.currentTime
          if (fadeNode !== null) {
            try {
              fadeNode.gain.cancelScheduledValues(now)
              fadeNode.gain.setValueAtTime(1, now)
            } catch (error) {
              // Already at unity.
            }
          }
          if (fadeNodeB !== null) {
            try {
              fadeNodeB.gain.cancelScheduledValues(now)
              fadeNodeB.gain.setValueAtTime(0, now)
            } catch (error) {
              // Already silenced.
            }
          }
        }
        if (audioB !== null) {
          try {
            audioB.pause()
            audioB.removeAttribute('src')
            audioB.load()
          } catch (error) {
            // Detached element: nothing to stop.
          }
        }
        releaseObjectUrlB()
        normalizeGainB = 1
        maybePrefetchNext()
      }

      function abortCrossfade() {
        if (!xfadePending && !xfadeActive && xfadeTimer === null && xfadePrepared === null) return
        xfadeToken += 1
        xfadePending = false
        xfadeActive = false
        xfadeAdopted = false
        xfadeNext = -1
        xfadePrepared = null
        if (xfadeTimer !== null) {
          clearTimeout(xfadeTimer)
          xfadeTimer = null
        }
        if (xfadeAdoptTimer !== null) {
          clearTimeout(xfadeAdoptTimer)
          xfadeAdoptTimer = null
        }
        if (audioB !== null) {
          try {
            audioB.pause()
            audioB.removeAttribute('src')
            audioB.load()
          } catch (error) {
            // Detached element: nothing to stop.
          }
        }
        releaseObjectUrlB()
        normalizeGainB = 1
        if (audioContext !== null) {
          var now = audioContext.currentTime
          if (fadeNode !== null) {
            try {
              fadeNode.gain.cancelScheduledValues(now)
              fadeNode.gain.setValueAtTime(1, now)
            } catch (error) {
              // Already at unity.
            }
          }
          if (fadeNodeB !== null) {
            try {
              fadeNodeB.gain.cancelScheduledValues(now)
              fadeNodeB.gain.setValueAtTime(0, now)
            } catch (error) {
              // Already silenced.
            }
          }
        }
      }

      function crossfadeActive() {
        return xfadeActive === true
      }

      var api = {
        subscribe: function (fn) {
          listeners.push(fn)
          return function () {
            listeners = listeners.filter(function (item) {
              return item !== fn
            })
          }
        },
        subscribeTime: function (fn) {
          timeListeners.push(fn)
          return function () {
            timeListeners = timeListeners.filter(function (item) {
              return item !== fn
            })
          }
        },
        subscribeError: function (fn) {
          errorListeners.push(fn)
          return function () {
            errorListeners = errorListeners.filter(function (item) {
              return item !== fn
            })
          }
        },
        getSnapshot: function () {
          return state
        },
        /** Merge probed audio facts (codec/sampleRate/bitrate) into a queued track. */
        updateTrack: function (path, info) {
          if (!path || !info || typeof info !== 'object') return
          var found = false
          var queue = state.queue.map(function (item) {
            if (!item || item.path !== path) return item
            found = true
            return Object.assign({}, item, info)
          })
          if (!found) return
          state = Object.assign({}, state, { queue: queue })
          emit()
        },
        getTime: function () {
          return { currentTime: state.currentTime, duration: state.duration, buffered: state.buffered }
        },
        /** Queue indices in the current playback order (random mode). */
        getPlayOrder: function () {
          return state.queue.map(function (_, index) {
            return index
          })
        },
        /** Restore the last queue/position once (called by the resident host). */
        tryRestore: tryRestore,
        /** Flush statistics + resume state when the page is hidden/closed. */
        flushOnHide: flushOnHide,
        /**
         * Lazily build the analyser graph. Called from a user gesture so the
         * AudioContext can start; connecting a media element source silences
         * the element until the context runs, so it must never be automatic.
         */
        ensureAnalyser: function () {
          if (audio === null) return null
          if (analyser !== null) return analyser
          if (!canRouteThroughWebAudio(audio)) return null
          try {
            var Ctx = window.AudioContext || window.webkitAudioContext
            if (!Ctx) return null
            if (audioContext === null) audioContext = new Ctx()
            deckSource = audioContext.createMediaElementSource(audio)
            preampNode = audioContext.createGain()
            eqNodes = buildEqNodes(audioContext)
            limiterNode = audioContext.createDynamicsCompressor()
            limiterNode.threshold.value = -1.5
            limiterNode.knee.value = 0
            limiterNode.ratio.value = 20
            limiterNode.attack.value = 0.003
            limiterNode.release.value = 0.15
            gainNode = audioContext.createGain()
            analyser = audioContext.createAnalyser()
            analyser.fftSize = 256
            analyser.smoothingTimeConstant = 0.82
            // Each deck owns a fade gain and a loudness trim; both sum into the
            // shared preamp so the EQ, limiter and analyser stay single-instance.
            fadeNode = audioContext.createGain()
            trimNode = audioContext.createGain()
            deckSource.connect(fadeNode)
            fadeNode.connect(trimNode)
            trimNode.connect(preampNode)
            var tail = preampNode
            for (var index = 0; index < eqNodes.length; index += 1) {
              tail.connect(eqNodes[index].node)
              tail = eqNodes[index].node
            }
            tail.connect(limiterNode)
            tail = limiterNode
            tail.connect(gainNode)
            gainNode.connect(analyser)
            analyser.connect(audioContext.destination)
            if (audio) audio.volume = state.volume
            wireSecondary()
            applyNormalizeGain(normalizeGain)
            applyEq(true)
            waveData = new Uint8Array(analyser.frequencyBinCount)
            if (audioContext.state === 'suspended') audioContext.resume().catch(function () {})
          } catch (error) {
            analyser = null
            return null
          }
          return analyser
        },
        /** Latest frequency data (0..255 per bin) or null when unavailable. */
        getWave: function () {
          if (analyser === null || waveData === null) return null
          analyser.getByteFrequencyData(waveData)
          return waveData
        },
        /** Hand the resident <audio> element to the engine (null detaches). */
        attachAudio: function (el) {
          if (audio === el) return
          abortCrossfade()
          cancelPrefetch()
          if (audio !== null) unbind(audio)
          if (audioB !== null) {
            unbind(audioB)
            if (audioB.parentNode) audioB.parentNode.removeChild(audioB)
            audioB = null
          }
          releaseObjectUrlB()
          // A new media element needs a fresh source node; close the old graph.
          if (audioContext !== null) {
            try {
              audioContext.close()
            } catch (error) {
              // Already closed.
            }
          }
          audioContext = null
          analyser = null
          gainNode = null
          preampNode = null
          limiterNode = null
          deckSource = null
          deckSourceB = null
          fadeNode = null
          fadeNodeB = null
          trimNode = null
          trimNodeB = null
          secondaryWired = false
          eqNodes = []
          waveData = null
          audio = el
          if (el === null) return
          bind(el)
          el.preload = 'metadata'
          el.volume = effectiveVolume()
          el.muted = state.muted
          ensureSecondary()
          var item = currentItem()
          if (item !== null) {
            if (objectUrl !== null) {
              el.src = objectUrl
              el.load()
              if (pendingAutoplay) playAfterLoudness(loadToken)
            } else {
              load(state.index, pendingAutoplay || state.playing)
            }
          }
          syncMediaSession()
        },
        setQueue: function (list) {
          // Never replace a queue that is already playing or paused mid-track.
          if (state.index >= 0) return
          var queue = state.order === 'random' ? shuffleTracks(list, null) : list.slice()
          state = Object.assign({}, state, { queue: queue, index: -1 })
          emit()
        },
        playList: function (list, at) {
          if (!list || list.length === 0) return
          var queue = list.slice()
          var index = at
          if (state.order === 'random') {
            queue = shuffleTracks(queue, queue[at])
            index = 0
          }
          state = Object.assign({}, state, { queue: queue, index: index })
          load(index, true)
        },
        /** Insert one track immediately after the current one, without interrupting playback. */
        enqueueNext: function (track) {
          if (track === null || track === undefined || typeof track.path !== 'string' || track.path === '') return
          if (state.queue.length === 0 || state.index < 0) {
            api.playList([track], 0)
            return
          }
          var at = Math.min(state.index + 1, state.queue.length)
          var queue = state.queue.slice()
          queue.splice(at, 0, track)
          state = Object.assign({}, state, { queue: queue })
          emit()
          savePlaybackState()
        },
        /** Append one track to the queue without interrupting playback. */
        enqueue: function (track) {
          if (track === null || track === undefined || typeof track.path !== 'string' || track.path === '') return
          if (state.queue.length === 0) {
            api.playList([track], 0)
            return
          }
          state = Object.assign({}, state, {
            queue: state.queue.concat([track]),
            index: state.index < 0 ? 0 : state.index,
          })
          emit()
          savePlaybackState()
        },
        select: function (list, at) {
          if (!list || list.length === 0 || at < 0) return
          if (at === state.index && sameQueue(list, state.queue)) {
            if (state.playing) api.pause()
            else api.play()
            return
          }
          if (!sameQueue(list, state.queue)) {
            var queue = list.slice()
            var index = at
            if (state.order === 'random') {
              queue = shuffleTracks(queue, queue[at])
              index = 0
            }
            state = Object.assign({}, state, { queue: queue, index: index })
            load(index, true)
            return
          }
          load(at, true)
        },
        clearQueue: function () {
          if (audio !== null) audio.pause()
          state = Object.assign({}, state, {
            queue: [],
            index: -1,
            playing: false,
            currentTime: 0,
            duration: 0,
          })
          emit()
          savePlaybackState()
        },
        moveQueue: function (from, to) {
          var length = state.queue.length
          if (from < 0 || from >= length || to < 0 || to >= length || from === to) return
          var list = state.queue.slice()
          var moved = list.splice(from, 1)[0]
          list.splice(to, 0, moved)
          var index = state.index
          if (from === index) {
            index = to
          } else {
            if (from < index) index -= 1
            if (to <= index) index += 1
          }
          state = Object.assign({}, state, { queue: list, index: index })
          emit()
          savePlaybackState()
        },
        /**
         * Reorder the queue to match the displayed order (drag & drop).
         * `indices` are original queue indices in their new visual order.
         * In random mode the new visual order becomes the play order too.
         */
        reorderQueue: function (indices) {
          var length = state.queue.length
          if (!Array.isArray(indices) || indices.length !== length) return
          var seen = {}
          for (var i = 0; i < length; i += 1) {
            var at = indices[i]
            if (!Number.isInteger(at) || at < 0 || at >= length || seen[at] === true) return
            seen[at] = true
          }
          var list = indices.map(function (at) {
            return state.queue[at]
          })
          var current = state.index >= 0 ? indices.indexOf(state.index) : -1
          state = Object.assign({}, state, { queue: list, index: current })
          emit()
          savePlaybackState()
        },
        removeQueueAt: function (at) {
          var length = state.queue.length
          if (at < 0 || at >= length) return
          var list = state.queue.slice()
          list.splice(at, 1)
          if (list.length === 0) {
            api.clearQueue()
            return
          }
          if (at === state.index) {
            var nextIndex = Math.min(at, list.length - 1)
            var shouldPlay = state.playing === true
            state = Object.assign({}, state, { queue: list })
            load(nextIndex, shouldPlay)
            return
          }
          var index = at < state.index ? state.index - 1 : state.index
          state = Object.assign({}, state, { queue: list, index: index })
          emit()
          savePlaybackState()
        },
        /** Move a queue entry to play right after the current track. */
        playNext: function (at) {
          var length = state.queue.length
          if (at < 0 || at >= length || state.index < 0) return
          var target = Math.min(state.index + 1, length - 1)
          if (at === state.index || at === target) return
          api.moveQueue(at, target)
        },
        play: function () {
          if (!leader) return
          if (state.index < 0) {
            if (state.queue.length > 0) load(0, true)
            return
          }
          if (audio === null) return
          var context = api.ensureAnalyser()
          if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
            audioContext.resume().catch(function () {
              // If the context cannot start, leave the media element untouched.
            })
          }
          pendingAutoplay = true
          // Wait for the current track's loudness result so the first audible
          // sample already has its final gain instead of ducking mid-play.
          playAfterLoudness(loadToken)
        },
        /** Called by the cross-tab coordinator; never plays in a follower tab. */
        setLeader: function (value) {
          var next = value === true
          if (leader === next) return
          leader = next
          if (!leader) {
            pendingAutoplay = false
            abortCrossfade()
            if (audio !== null) audio.pause()
            if (audioB !== null) audioB.pause()
            if (state.playing) patch({ playing: false })
          }
          emit()
        },
        isLeader: function () {
          return leader
        },
        /** Test/diagnostic view of the two-deck hand-over (no controls). */
        getCrossfadeState: function () {
          return {
            active: xfadeActive,
            pending: xfadePending,
            adopted: xfadeAdopted,
            secondary: audioB !== null,
            wired: secondaryWired,
            next: xfadeNext,
          }
        },
        pause: function () {
          pendingAutoplay = false
          abortCrossfade()
          if (audio) audio.pause()
        },
        toggle: function () {
          if (state.playing) api.pause()
          else api.play()
        },
        next: function () {
          if (state.queue.length === 0) return
          load(nextIndexOf(state.index, state.queue.length), true)
        },
        prev: function () {
          if (state.queue.length === 0) return
          load(prevIndexOf(state.index, state.queue.length), true)
        },
        seek: function (seconds) {
          if (audio === null) return
          // A seek during a fade would desync the two decks; drop the fade first.
          abortCrossfade()
          var el = audio
          var item = currentItem()
          // Media duration is unavailable until metadata lands; the scanned
          // track duration is the correct fallback, never a 1-second guess.
          var limit = isFinite(el.duration) && el.duration > 0
            ? el.duration
            : item && item.durationSec > 0
              ? item.durationSec
              : 0
          var target = clamp(seconds, 0, limit > 0 ? limit : seconds)
          if (!isFinite(target)) return

          function apply() {
            try {
              el.currentTime = target
            } catch (error) {
              return
            }
            state = Object.assign({}, state, { currentTime: target })
            emitTime()
          }

          if (el.readyState >= 1) {
            apply()
            return
          }
          var once = function () {
            el.removeEventListener('loadedmetadata', once)
            apply()
          }
          el.addEventListener('loadedmetadata', once)
          try {
            el.currentTime = target
          } catch (error) {
            // The listener above retries once metadata is ready.
          }
        },
        setNormalize: function (value) {
          savePrefs({ normalizeVolume: value !== false })
          if (value === false) {
            loudnessToken += 1
            applyNormalizeGain(1)
          } else if (currentItem()) {
            scheduleLoudness(currentItem(), currentLoudnessBlob)
          }
        },
        /**
         * Update the equalizer. Every call persists, so the panel can drive this
         * directly without a second write path. Enabling builds the graph on the
         * spot: the click that flips the switch is the user gesture Web Audio needs.
         */
        setEq: function (patch) {
          var source = patch !== null && typeof patch === 'object' ? patch : {}
          var bands = source.bands === undefined ? eq.bands.slice() : normalizeEqBands(source.bands)
          var preset
          if (source.preset === undefined) {
            // A band edit without an explicit preset still has to name its curve.
            preset = source.bands === undefined ? eq.preset : eqPresetForBands(bands)
          } else if (source.preset === 'custom') {
            preset = 'custom'
          } else if (source.preset === 'device') {
            preset = 'device'
          } else {
            preset = eqPresetById(source.preset) === null ? 'flat' : String(source.preset)
          }
          var next = {
            enabled: source.enabled === undefined ? eq.enabled : source.enabled === true,
            preset: preset,
            bands: bands,
            preamp:
              source.preamp === undefined
                ? eq.preamp
                : Math.round(clamp(Number(source.preamp) || 0, -EQ_PREAMP_MAX, EQ_PREAMP_MAX)),
            device:
              source.device === undefined
                ? preset === 'device'
                  ? eq.device
                  : ''
                : String(source.device || ''),
          }
          eq = next
          savePrefs({
            eqEnabled: next.enabled,
            eqPreset: next.preset,
            eqBands: next.bands,
            eqPreamp: next.preamp,
            // Any EQ change also re-writes the layout tag, so a library upgrade can
            // tell which band grid the stored bands belong to.
            eqLayout: EQ_LAYOUT,
            eqDevice: next.device,
          })
          if (next.enabled && analyser === null) api.ensureAnalyser()
          applyEq(next.enabled !== true)
        },
        getEq: function () {
          return {
            enabled: eq.enabled,
            preset: eq.preset,
            bands: eq.bands.slice(),
            preamp: eq.preamp,
            device: eq.device,
            /** False when the browser cannot host the graph (EQ is inert then). */
            available: eqSupported() && (analyser !== null || audio === null || canRouteThroughWebAudio(audio)),
          }
        },
        setVolume: function (value) {
          var next = clamp(value, 0, 1)
          state = Object.assign({}, state, { volume: next, muted: next > 0 ? state.muted : false })
          applyOutputVolume()
          savePrefs({ volume: next })
          emit()
        },
        setMuted: function (value) {
          state = Object.assign({}, state, { muted: value })
          if (audio) audio.muted = value
          if (audioB) audioB.muted = value
          emit()
        },
        setLoop: function (value) {
          if (value === 'one') abortCrossfade()
          state = Object.assign({}, state, { loop: value })
          savePrefs({ loop: value })
          emit()
        },
        setOrder: function (value) {
          var next = value === 'random' ? 'random' : 'list'
          if (next === 'random' && state.queue.length > 1) {
            // Shuffle the canonical queue once; the panel order is the play order.
            var current = currentItem()
            var queue = shuffleTracks(state.queue, current)
            state = Object.assign({}, state, { queue: queue, index: current ? 0 : state.index, order: next })
          } else {
            state = Object.assign({}, state, { order: next })
          }
          savePrefs({ order: next })
          emit()
          savePlaybackState()
          // The neighbour changed; drop the old prefetch and warm the new one.
          cancelPrefetch()
          maybePrefetchNext()
        },
        clear: function () {
          loadToken += 1
          cancelPendingFetch()
          abortCrossfade()
          cancelPrefetch()
          currentBlob = null
          releaseObjectUrl()
          if (audio) {
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
          }
          state = Object.assign({}, state, {
            queue: [],
            index: -1,
            playing: false,
            currentTime: 0,
            duration: 0,
            buffered: 0,
          })
          emit()
          syncMediaSession()
        },
        suspend: function () {
          if (audio) audio.pause()
        },
        destroy: function () {
          stopLeaderElection()
          loadToken += 1
          cancelPendingFetch()
          releaseObjectUrl()
          if (audio) {
            unbind(audio)
            audio.pause()
            audio.removeAttribute('src')
            audio = null
          }
        },
      }

      // ── cross-window leader (one audible player per browser profile) ─────
      function readLease() {
        try {
          var raw = window.localStorage.getItem(LEADER_KEY)
          var value = raw === null ? null : JSON.parse(raw)
          return value !== null && typeof value === 'object' ? value : null
        } catch {
          return null
        }
      }

      function claimLeader() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return true
        try {
          var now = Date.now()
          var lease = readLease()
          if (lease !== null && lease.id !== tabId && now - Number(lease.at || 0) < 7000) {
            if (leader) {
              leader = false
              if (audio !== null) audio.pause()
              if (state.playing) patch({ playing: false })
              emit()
            }
            return false
          }
          window.localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, at: now }))
          if (!leader) {
            leader = true
            emit()
          }
          return true
        } catch {
          return true
        }
      }

      function releaseLeader() {
        try {
          var lease = readLease()
          if (lease !== null && lease.id === tabId) window.localStorage.removeItem(LEADER_KEY)
        } catch {
          // Best effort.
        }
      }

      function startLeaderElection() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
        claimLeader()
        leaderTimer = setInterval(claimLeader, 2000)
        if (leaderTimer && typeof leaderTimer.unref === 'function') leaderTimer.unref()
        window.addEventListener('beforeunload', releaseLeader)
        window.addEventListener('pagehide', releaseLeader)
      }

      function stopLeaderElection() {
        if (leaderTimer !== null) clearInterval(leaderTimer)
        leaderTimer = null
        if (typeof window !== 'undefined') {
          window.removeEventListener('beforeunload', releaseLeader)
          window.removeEventListener('pagehide', releaseLeader)
        }
        releaseLeader()
      }

      try {
        startLeaderElection()
      } catch {
        // localStorage can be unavailable in private/browser test modes.
      }

      syncMediaHandlers()
      if (typeof window !== 'undefined') window[PLAYER_KEY] = api
      return api
    }

    var player = createPlayer()

    // ── src/60-library.js
    /**
     * library: scanned tracks, favorites, playlists, stats and config.
     *
     * Views read this store; actions are plain async functions so they can be
     * called from event handlers without a hook layer.
     */

    var libraryStore = createStore({
      phase: 'idle', // idle | loading | ready | error
      tracks: [],
      roots: [],
      warnings: [],
      error: '',
      scannedAt: 0,
      config: null,
      favorites: [],
      playlists: [],
      stats: {},
      statsRange: 'all',
    })

    var libraryToken = 0

    async function loadLibrary(refresh) {
      var token = (libraryToken += 1)
      libraryStore.set({ phase: 'loading', error: '' })
      try {
        var body = await getJson(API + 'library' + (refresh === true ? '?refresh=1' : ''))
        if (token !== libraryToken) return
        libraryStore.set({
          phase: 'ready',
          tracks: Array.isArray(body.tracks) ? body.tracks : [],
          roots: Array.isArray(body.roots) ? body.roots : [],
          warnings: Array.isArray(body.warnings) ? body.warnings : [],
          truncated: body.truncated === true,
          scannedAt: body.scannedAt || 0,
          config: body.config || libraryStore.get().config,
          error: '',
        })
      } catch (error) {
        if (token !== libraryToken) return
        libraryStore.set({ phase: 'error', error: errorText(error) })
      }
    }

    function tracksNow() {
      return libraryStore.get().tracks
    }

    function trackByPath(path) {
      var list = tracksNow()
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].path === path) return list[i]
      }
      return null
    }

    function favoritePaths(list) {
      var out = []
      if (!Array.isArray(list)) return out
      list.forEach(function (item) {
        var path = typeof item === 'string' ? item : item && typeof item.path === 'string' ? item.path : ''
        if (path) out.push(path)
      })
      return out
    }

    function favoriteSet() {
      var set = {}
      var list = favoritePaths(libraryStore.get().favorites)
      for (var i = 0; i < list.length; i += 1) set[list[i]] = true
      return set
    }

    async function loadFavorites() {
      try {
        var body = await getJson(API + 'favorites')
        libraryStore.set({ favorites: favoritePaths(body.favorites) })
      } catch (error) {
        // Favorites are optional; the panel still works without them.
      }
    }

    async function toggleFavorite(path) {
      if (!path) return
      try {
        var body = await postJson(API + 'favorites', { path: path })
        libraryStore.set({ favorites: favoritePaths(body.favorites) })
      } catch (error) {
        showToast(errorText(error))
      }
    }

    async function loadPlaylists() {
      try {
        var body = await getJson(API + 'playlists')
        libraryStore.set({ playlists: Array.isArray(body.playlists) ? body.playlists : [] })
      } catch (error) {
        libraryStore.set({ playlists: [] })
      }
    }

    async function createPlaylist(name) {
      try {
        var body = await postJson(API + 'playlists', { name: name })
        await loadPlaylists()
        return body.playlist
      } catch (error) {
        showToast(errorText(error))
        return null
      }
    }

    async function patchPlaylist(id, patch) {
      try {
        await sendJson('PATCH', API + 'playlists/' + encodeURIComponent(id), patch)
        await loadPlaylists()
        return true
      } catch (error) {
        showToast(errorText(error))
        return false
      }
    }

    async function removePlaylist(id) {
      try {
        await sendJson('DELETE', API + 'playlists/' + encodeURIComponent(id))
        await loadPlaylists()
        return true
      } catch (error) {
        showToast(errorText(error))
        return false
      }
    }

    async function addToPlaylist(id, paths) {
      var list = Array.isArray(paths) ? paths : [paths]
      return patchPlaylist(id, { add: list })
    }

    async function loadStats(range) {
      var next = range === 'week' || range === 'month' ? range : 'all'
      libraryStore.set({ statsRange: next })
      try {
        var body = await getJson(API + 'stats?range=' + encodeURIComponent(next))
        libraryStore.set({ stats: body.tracks || {} })
      } catch (error) {
        libraryStore.set({ stats: {} })
      }
    }

    async function loadConfig() {
      try {
        var body = await getJson(API + 'config')
        libraryStore.set({ config: body.config || null })
        return body.config || null
      } catch (error) {
        return null
      }
    }

    async function saveConfig(patch) {
      try {
        var body = await postJson(API + 'config', patch)
        libraryStore.set({ config: body.config || null })
        await loadLibrary(true)
        return true
      } catch (error) {
        showToast(errorText(error))
        return false
      }
    }

    function playlistTracks(playlist) {
      if (!playlist || !Array.isArray(playlist.trackPaths)) return []
      var out = []
      for (var i = 0; i < playlist.trackPaths.length; i += 1) {
        var track = trackByPath(playlist.trackPaths[i])
        if (track !== null) out.push(track)
      }
      return out
    }

    function playlistById(id) {
      var list = libraryStore.get().playlists
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].id === id) return list[i]
      }
      return null
    }

    // ── src/70-online.js
    /**
     * online: NetEase / QQ / KuGou state.
     *
     * Only the client half lives here: the Host performs every provider request.
     */

    var ONLINE_HISTORY_KEY = 'mu.onlineHistory'
    var ONLINE_HISTORY_MAX = 50

    function readOnlineHistory() {
      var list = storageGet(ONLINE_HISTORY_KEY, [])
      return Array.isArray(list) ? list : []
    }

    function writeOnlineHistory(list) {
      storageSet(ONLINE_HISTORY_KEY, list.slice(0, ONLINE_HISTORY_MAX))
    }

    function onlineHistoryOfProvider(provider) {
      return onlineStore.get().history.filter(function (item) {
        return item.provider === provider
      })
    }

    var onlineStore = createStore({
      provider: 'netease',
      phase: 'idle', // idle | searching | ready | error
      query: '',
      results: [],
      searchPage: 1,
      searchTotal: 0,
      searchLoadingMore: false,
      error: '',
      playlistsPhase: 'idle',
      playlistsProvider: '',
      playlistsRefreshing: false,
      playlists: [],
      authExpired: '',
      playlistId: '',
      playlistName: '',
      playlistSongs: [],
      playlistPhase: 'idle',
      playlistRefreshing: false,
      albumId: '',
      albumName: '',
      albumArtist: '',
      albumCover: '',
      albumProvider: '',
      albumSongs: [],
      albumPhase: 'idle',
      albumError: '',
      artistName: '',
      artistProvider: '',
      artistFrom: '',
      artistSongs: [],
      artistPhase: 'idle',
      artistError: '',
      history: readOnlineHistory(),
      liked: {},
      cache: {},
      progress: {},
      providers: {},
    })

    var onlineSearchToken = 0
    var playlistLoadToken = 0
    var playlistCache = new Map()
    var playlistInflight = new Map()
    var PLAYLIST_CACHE_TTL = 60 * 1000

    async function searchOnline(text, page, append) {
      var query = String(text || '').trim()
      if (query === '') return
      var targetPage = Math.max(1, Number(page) || 1)
      var more = append === true && targetPage > 1
      var state = onlineStore.get()
      var provider = state.provider
      var token = (onlineSearchToken += 1)
      if (more) {
        onlineStore.set({ searchLoadingMore: true })
      } else {
        onlineStore.set({
          phase: 'searching',
          query: query,
          error: '',
          results: [],
          searchPage: 1,
          searchTotal: 0,
          searchLoadingMore: false,
        })
      }
      try {
        var body = await getJson(
          API +
            'online/search?provider=' +
            encodeURIComponent(provider) +
            '&q=' +
            encodeURIComponent(query) +
            '&page=' +
            String(targetPage),
        )
        if (token !== onlineSearchToken) return
        var incoming = Array.isArray(body.results) ? body.results : []
        var results = more ? (onlineStore.get().results || []).slice() : []
        incoming.forEach(function (item) {
          var path = 'online:' + provider + ':' + item.id
          if (!results.some(function (existing) { return 'online:' + provider + ':' + existing.id === path })) {
            results.push(item)
          }
        })
        onlineStore.set({
          phase: 'ready',
          results: results,
          searchPage: Number(body.page) || targetPage,
          searchTotal: Number(body.total) || results.length,
          searchLoadingMore: false,
        })
        void refreshCacheStatus(provider, incoming.map(function (item) { return item.id }))
      } catch (error) {
        if (token !== onlineSearchToken) return
        if (more) {
          onlineStore.set({ searchLoadingMore: false })
          showToast(errorText(error))
        } else {
          onlineStore.set({ phase: 'error', error: errorText(error) })
        }
      }
    }

    async function refreshCacheStatus(provider, ids) {
      var list = (ids || []).filter(Boolean).slice(0, 120)
      if (list.length === 0) return
      try {
        var body = await getJson(
          API +
            'online/cache/status?provider=' +
            encodeURIComponent(provider) +
            '&ids=' +
            encodeURIComponent(list.join(',')),
        )
        var state = onlineStore.get()
        onlineStore.set({
          cache: Object.assign({}, state.cache, body.cached || {}),
          progress: Object.assign({}, state.progress, body.progress || {}),
        })
      } catch (error) {
        // Cache badges are cosmetic.
      }
    }

    function isAuthError(message) {
      return /20017|登录态|重新扫码|未登录|登录.*(失效|过期)|session|cookie|token|鉴权|401|403/i.test(
        String(message || ''),
      )
    }

    function mergePlaylists(previous, incoming) {
      var next = new Map()
      ;(incoming || []).forEach(function (item) {
        if (item && item.id !== undefined) next.set(String(item.id), item)
      })
      var merged = []
      ;(previous || []).forEach(function (item) {
        var fresh = next.get(String(item.id))
        if (fresh) {
          merged.push(Object.assign({}, item, fresh))
          next.delete(String(item.id))
        }
      })
      next.forEach(function (item) {
        merged.push(item)
      })
      return merged
    }

    async function loadMyPlaylists(provider) {
      var target = provider || onlineStore.get().provider
      var token = (playlistLoadToken += 1)
      var snapshot = onlineStore.get()
      var keep = snapshot.playlistsProvider === target && (snapshot.playlists || []).length > 0
      onlineStore.set(
        keep
          ? { playlistsPhase: 'ready', playlistsRefreshing: true, playlistsProvider: target, error: '' }
          : { playlistsPhase: 'loading', playlistsRefreshing: false, playlistsProvider: target, playlists: [] },
      )
      try {
        var body = await getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(target))
        if (token !== playlistLoadToken) return
        var incoming = Array.isArray(body.playlists) ? body.playlists : []
        var current = onlineStore.get()
        onlineStore.set({
          playlistsPhase: 'ready',
          playlistsRefreshing: false,
          playlistsProvider: target,
          playlists: keep ? mergePlaylists(current.playlists, incoming) : incoming,
          error: '',
          authExpired: '',
        })
      } catch (error) {
        if (token !== playlistLoadToken) return
        var state = onlineStore.get()
        if (state.playlistsProvider === target && (state.playlists || []).length > 0) {
          // Stale-while-revalidate: keep the last good list visible.
          var message = errorText(error)
          onlineStore.set({
            playlistsPhase: 'ready',
            playlistsRefreshing: false,
            error: message,
            authExpired: isAuthError(message) ? target : '',
          })
        } else {
          onlineStore.set({
            playlistsPhase: 'error',
            playlistsRefreshing: false,
            playlistsProvider: target,
            playlists: [],
            error: errorText(error),
            authExpired: isAuthError(errorText(error)) ? target : '',
          })
        }
      }
    }

    /** Re-read the likes playlist after a cloud like/unlike from any surface. */
    function refreshLikedPlaylist(delta) {
      var state = onlineStore.get()
      var liked = (state.playlists || []).find(function (item) {
        return item.isLike === true
      }) || (state.playlists || []).find(function (item) {
        return item.kind === 'default' || item.isDefault === true
      })
      if (liked) {
        var count = Math.max(0, (Number(liked.trackCount) || 0) + (Number(delta) || 0))
        var playlists = (state.playlists || []).map(function (item) {
          return String(item.id) === String(liked.id) ? Object.assign({}, item, { trackCount: count }) : item
        })
        onlineStore.set({ playlists: playlists, playlistsRefreshing: true })
        if (String(state.playlistId) === String(liked.id)) void openOnlinePlaylist(Object.assign({}, liked, { trackCount: count }), true)
      }
      void loadMyPlaylists(state.provider)
    }

    function resetOnlineAccountData() {
      playlistLoadToken += 1
      onlineSearchToken += 1
      artistLoadToken += 1
      playlistCache.clear()
      playlistInflight.clear()
      onlineStore.set({
        playlistsPhase: 'idle',
        playlistsRefreshing: false,
        playlistsProvider: '',
        playlists: [],
        playlistId: '',
        playlistName: '',
        playlistSongs: [],
        playlistPhase: 'idle',
        playlistRefreshing: false,
        albumId: '',
        albumName: '',
        albumArtist: '',
        albumCover: '',
        albumProvider: '',
        albumSongs: [],
        albumPhase: 'idle',
        albumError: '',
        artistName: '',
        artistProvider: '',
        artistFrom: '',
        artistSongs: [],
        artistPhase: 'idle',
        artistError: '',
        liked: {},
        error: '',
        authExpired: '',
      })
    }

    function playlistCacheKey(provider, id) {
      return String(provider || '') + ':' + String(id || '')
    }

    var albumLoadToken = 0
    var artistLoadToken = 0

    async function openOnlineAlbum(track) {
      if (!track || !track.album) return
      var provider = track.onlineProvider || onlineStore.get().provider
      var token = (albumLoadToken += 1)
      onlineStore.set({
        albumId: String(track.albumId || ''),
        albumName: String(track.album || ''),
        albumArtist: String(track.artist || ''),
        albumCover: String(track.coverUrl || ''),
        albumProvider: provider,
        albumSongs: [],
        albumPhase: 'loading',
        albumError: '',
      })
      setNav('album')
      try {
        var body = await getJson(
          API +
            'online/album?provider=' +
            encodeURIComponent(provider) +
            '&id=' +
            encodeURIComponent(track.albumId || '') +
            '&album=' +
            encodeURIComponent(track.album || '') +
            '&artist=' +
            encodeURIComponent(track.artist || ''),
        )
        if (token !== albumLoadToken) return
        onlineStore.set({
          albumName: body.name || track.album || '',
          albumArtist: body.artist || track.artist || '',
          albumCover: body.cover || track.coverUrl || '',
          albumSongs: Array.isArray(body.songs) ? body.songs : [],
          albumPhase: 'ready',
        })
      } catch (error) {
        if (token !== albumLoadToken) return
        onlineStore.set({
          albumSongs: [],
          albumPhase: 'error',
          albumError: errorText(error),
        })
      }
    }

    function closeOnlineAlbum() {
      albumLoadToken += 1
      onlineStore.set({
        albumId: '',
        albumName: '',
        albumArtist: '',
        albumCover: '',
        albumProvider: '',
        albumSongs: [],
        albumPhase: 'idle',
        albumError: '',
      })
    }

    /**
     * Artist song list, built from the provider's search endpoint and filtered to
     * the clicked artist. Chinese providers have no artist catalogue endpoint, so
     * this keeps one shared list shape instead of a provider-specific page.
     */
    async function openOnlineArtist(track, artistOverride) {
      var names = trackArtistNames(track)
      var artist = String(artistOverride || (names.length > 0 ? names[0] : (track && track.artist)) || '').trim()
      if (artist === '') return
      var provider = (track && track.onlineProvider) || onlineStore.get().provider
      var from = uiStore.get().nav
      var token = (artistLoadToken += 1)
      onlineStore.set({
        artistName: artist,
        artistProvider: provider,
        artistFrom: from,
        artistSongs: [],
        artistPhase: 'loading',
        artistError: '',
        query: '',
        phase: 'idle',
        error: '',
      })
      setNav('artistSongs')
      try {
        var body = await getJson(
          API +
            'online/artist-songs?provider=' +
            encodeURIComponent(provider) +
            '&artist=' +
            encodeURIComponent(artist),
        )
        if (token !== artistLoadToken) return
        var songs = Array.isArray(body.songs) ? body.songs : []
        onlineStore.set({ artistSongs: songs, artistPhase: 'ready' })
        void refreshCacheStatus(
          provider,
          songs.map(function (item) {
            return item.id
          }),
        )
      } catch (error) {
        if (token !== artistLoadToken) return
        onlineStore.set({ artistSongs: [], artistPhase: 'error', artistError: errorText(error) })
      }
    }

    function closeOnlineArtist() {
      artistLoadToken += 1
      onlineStore.set({
        artistName: '',
        artistProvider: '',
        artistFrom: '',
        artistSongs: [],
        artistPhase: 'idle',
        artistError: '',
      })
    }

    function trimPlaylistCache() {
      if (playlistCache.size <= 24) return
      var old = []
      playlistCache.forEach(function (value, key) {
        old.push({ key: key, at: value.at || 0 })
      })
      old
        .sort(function (left, right) {
          return left.at - right.at
        })
        .slice(0, playlistCache.size - 24)
        .forEach(function (row) {
          playlistCache.delete(row.key)
        })
    }

    function fetchPlaylistSongs(provider, id, force) {
      var key = playlistCacheKey(provider, id)
      if (!force && playlistInflight.has(key)) return playlistInflight.get(key)
      var request = getJson(
        API +
          'online/playlist-songs?provider=' +
          encodeURIComponent(provider) +
          '&id=' +
          encodeURIComponent(id),
      )
        .then(function (body) {
          var songs = Array.isArray(body.songs) ? body.songs : []
          playlistCache.set(key, {
            songs: songs,
            name: body.name || '',
            at: Date.now(),
          })
          trimPlaylistCache()
          return { songs: songs, name: body.name || '' }
        })
        .finally(function () {
          if (playlistInflight.get(key) === request) playlistInflight.delete(key)
        })
      playlistInflight.set(key, request)
      return request
    }

    /** Warm the cache when the pointer/focus reaches a playlist nav item. */
    function prefetchOnlinePlaylist(playlist) {
      if (!playlist || !playlist.id) return
      var provider = onlineStore.get().provider
      var key = playlistCacheKey(provider, playlist.id)
      var hit = playlistCache.get(key)
      if (hit && Date.now() - (hit.at || 0) < PLAYLIST_CACHE_TTL) return
      void fetchPlaylistSongs(provider, playlist.id, false).catch(function () {
        // Prefetch is best effort.
      })
    }

    async function openOnlinePlaylist(playlist, force) {
      if (!playlist || !playlist.id) return
      var provider = onlineStore.get().provider
      var key = playlistCacheKey(provider, playlist.id)
      var hit = playlistCache.get(key)
      var fresh = hit && Date.now() - (hit.at || 0) < PLAYLIST_CACHE_TTL
      onlineStore.set({
        playlistId: playlist.id,
        playlistName: playlist.name || (hit && hit.name) || '',
        playlistPhase: hit ? 'ready' : 'loading',
        playlistSongs: hit ? hit.songs : [],
        playlistRefreshing: false,
      })
      if (fresh && force !== true) return
      if (hit) onlineStore.set({ playlistRefreshing: true })
      try {
        var body = await fetchPlaylistSongs(provider, playlist.id, force === true)
        var state = onlineStore.get()
        if (String(state.playlistId) !== String(playlist.id) || state.provider !== provider) return
        onlineStore.set({
          playlistPhase: 'ready',
          playlistRefreshing: false,
          playlistName: body.name || playlist.name || '',
          playlistSongs: body.songs,
          error: '',
        })
        void refreshCacheStatus(provider, body.songs.map(function (item) { return item.id }))
      } catch (error) {
        var current = onlineStore.get()
        if (String(current.playlistId) !== String(playlist.id) || current.provider !== provider) return
        if (hit) {
          onlineStore.set({ playlistPhase: 'ready', playlistRefreshing: false, error: errorText(error) })
        } else {
          onlineStore.set({ playlistPhase: 'error', playlistRefreshing: false, playlistSongs: [], error: errorText(error) })
        }
      }
    }

    function closeOnlinePlaylist() {
      onlineStore.set({ playlistId: '', playlistName: '', playlistSongs: [], playlistPhase: 'idle' })
    }

    async function loadProviders() {
      try {
        var body = await getJson(API + 'online/providers')
        onlineStore.set({ providers: body.providers || {} })
      } catch (error) {
        // Provider status only drives labels.
      }
    }

    function rememberOnline(track) {
      var entry = {
        provider: track.onlineProvider,
        id: track.onlineId || '',
        title: track.title || '',
        artist: track.artist || '',
        album: track.album || '',
        albumId: track.albumId || '',
        durationSec: track.durationSec || 0,
        coverUrl: track.coverUrl || '',
        // Without this the recent list loses artwork for self-hosted tracks once
        // the entry round-trips through storage.
        coverArtId: track.coverArtId || '',
        qualityHint: track.qualityHint || '',
        playedAt: Date.now(),
      }
      if (!entry.provider || entry.id === '') return
      var state = onlineStore.get()
      var next = [entry].concat(
        state.history.filter(function (item) {
          return !(item.provider === entry.provider && item.id === entry.id)
        }),
      )
      onlineStore.set({ history: next })
      writeOnlineHistory(next)
    }

    function removeHistory(entry) {
      var state = onlineStore.get()
      var next = state.history.filter(function (item) {
        return !(item.provider === entry.provider && item.id === entry.id)
      })
      onlineStore.set({ history: next })
      writeOnlineHistory(next)
    }

    function playOnlineResults(results, index) {
      var list = Array.isArray(results) ? results : []
      var wanted = list[index]
      // Never pre-block VIP tracks on the client: whether a track is playable
      // depends on the signed-in account, and the Host resolves that with cookies.
      var provider = (wanted && wanted.provider) || (list[0] && list[0].provider) || ''
      var account = onlineStore.get().providers[provider] || {}
      // Strict gate: a VIP track is only allowed when the provider summary
      // explicitly says this account is logged in with VIP. Unknown/stale state
      // must not be treated as permission.
      var allowVip = account.loggedIn === true && account.vip === true
      var playable = list.filter(function (item) {
        return item && item.id && (item.qualityHint !== 'VIP' || allowVip)
      })
      if (playable.length === 0) {
        showToast(t('online.vipOnly'))
        return
      }
      var skippedVip = list.filter(function (item) {
        return item && item.id && item.qualityHint === 'VIP' && !allowVip
      }).length
      if (skippedVip > 0 && !(wanted && wanted.qualityHint === 'VIP')) {
        showToast(t('online.vipSkipped', { n: skippedVip }))
      }
      var at = 0
      if (wanted) {
        for (var i = 0; i < playable.length; i += 1) {
          if (playable[i].provider === wanted.provider && playable[i].id === wanted.id) {
            at = i
            break
          }
        }
        if (wanted.qualityHint === 'VIP' && !allowVip) {
          showToast(t('online.vipOnly'))
          return
        }
      }
      var tracks = playable.map(onlineTrackOf)
      player.playList(tracks, at)
      rememberOnline(tracks[at])
      if (tracks[at] && tracks[at].onlineProvider) {
        void refreshCacheStatus(tracks[at].onlineProvider, [tracks[at].onlineId])
      }
    }

    function playHistoryEntry(entry) {
      var track = onlineTrackOf(entry)
      player.playList([track], 0)
      rememberOnline(track)
    }

    async function startProviderLogin(provider, mode) {
      var body = await postJson(API + 'online/login/start', { provider: provider, mode: mode })
      return body
    }

    async function checkProviderLogin(provider, key, mode) {
      var body = await getJson(
        API +
          'online/login/status?provider=' +
          encodeURIComponent(provider) +
          '&key=' +
          encodeURIComponent(key) +
          '&mode=' +
          encodeURIComponent(mode || 'qq'),
      )
      return body.status
    }

    async function logoutProvider(provider) {
      try {
        await postJson(API + 'online/logout', { provider: provider })
        resetOnlineAccountData()
        await loadProviders()
        showToast(t('online.logoutDone'))
      } catch (error) {
        showToast(errorText(error))
      }
    }

    /**
     * Navidrome credentials form state.
     *
     * The password never leaves this component except in the one POST that trades
     * it for a salted token; the Host stores only salt + token.
     */
    function useNavidromeForm() {
      var serverPair = useState('')
      var userPair = useState('')
      var passPair = useState('')
      var phasePair = useState('idle') // idle | loading
      var errorPair = useState('')
      var noticePair = useState('')

      var setServer = serverPair[1]
      var setUsername = userPair[1]
      var setPassword = passPair[1]
      var setPhase = phasePair[1]
      var setError = errorPair[1]
      var setNotice = noticePair[1]

      function reset() {
        setServer('')
        setUsername('')
        setPassword('')
        setPhase('idle')
        setError('')
        setNotice('')
      }

      async function connect() {
        var server = String(serverPair[0] || '').trim()
        var username = String(userPair[0] || '').trim()
        var password = String(passPair[0] || '')
        setError('')
        setNotice('')
        if (!/^https?:\/\//i.test(server)) {
          setError(t('online.navidromeBadServer'))
          return
        }
        if (username === '' || password === '') {
          setError(t('online.accountHint'))
          return
        }
        setPhase('loading')
        try {
          var result = await postJson(API + 'online/navidrome/login', {
            server: server,
            username: username,
            password: password,
          })
          setPassword('')
          setPhase('idle')
          setNotice(t('online.navidromeOk', { version: (result && result.serverVersion) || 'ok' }))
          await loadProviders()
          showToast(t('online.loginSuccess'))
        } catch (error) {
          setPhase('idle')
          setError(errorText(error))
        }
      }

      return {
        server: serverPair[0],
        username: userPair[0],
        password: passPair[0],
        phase: phasePair[0],
        error: errorPair[0],
        notice: noticePair[0],
        setServer: setServer,
        setUsername: setUsername,
        setPassword: setPassword,
        connect: connect,
        reset: reset,
      }
    }

    // ── src/80-overlay.js
    /**
     * overlay: the single layer stack plus toast.
     *
     * Every popover, dialog and sheet pushes onto this stack; Escape pops the top
     * one. Nothing else in the UI is allowed to invent a z-index.
     */

    var overlayStore = createStore({ layers: [] })
    var toastStore = createStore({ text: '', seq: 0 })
    var toastTimer = null

    function pushLayer(kind, props) {
      var layers = overlayStore.get().layers.filter(function (layer) {
        return layer.kind !== kind
      })
      layers.push({ kind: kind, props: props || {} })
      overlayStore.set({ layers: layers })
    }

    function popLayer() {
      var layers = overlayStore.get().layers
      if (layers.length === 0) return false
      overlayStore.set({ layers: layers.slice(0, layers.length - 1) })
      return true
    }

    function removeLayer(kind) {
      var layers = overlayStore.get().layers
      var next = layers.filter(function (layer) {
        return layer.kind !== kind
      })
      if (next.length !== layers.length) overlayStore.set({ layers: next })
    }

    function topLayer() {
      var layers = overlayStore.get().layers
      return layers.length > 0 ? layers[layers.length - 1] : null
    }

    function hasLayer(kind) {
      return overlayStore.get().layers.some(function (layer) {
        return layer.kind === kind
      })
    }

    function showToast(text) {
      var message = String(text || '')
      if (message === '') return
      var seq = toastStore.get().seq + 1
      toastStore.set({ text: message, seq: seq })
      if (toastTimer !== null) clearTimeout(toastTimer)
      toastTimer = setTimeout(function () {
        toastTimer = null
        if (toastStore.get().seq === seq) toastStore.set({ text: '', seq: seq })
      }, 1800)
    }

    // ── src/85-select.js
    /**
     * selection + bulk actions + duplicate detection.
     */

    var selectionStore = createStore({ active: false, paths: [] })

    function selectedPaths() {
      return selectionStore.get().paths.slice()
    }

    function selectedPathSet() {
      var set = {}
      selectionStore.get().paths.forEach(function (path) {
        set[path] = true
      })
      return set
    }

    function setSelectionMode(active) {
      var state = selectionStore.get()
      selectionStore.set({ active: active === true, paths: active === true ? state.paths : [] })
    }

    function toggleSelected(path) {
      var state = selectionStore.get()
      var list = state.paths.slice()
      var at = list.indexOf(path)
      if (at >= 0) list.splice(at, 1)
      else list.push(path)
      selectionStore.set({ active: list.length > 0 ? state.active : false, paths: list })
    }

    function clearSelection() {
      selectionStore.set({ active: false, paths: [] })
    }

    function selectAllPaths(paths) {
      selectionStore.set({ active: true, paths: (paths || []).slice() })
    }

    var rangePick = { active: false, anchor: '' }

    /** Select the whole current list (enters selection mode). */
    function selectAllIn(list) {
      selectionStore.set({
        active: true,
        paths: (list || []).map(function (track) {
          return track.path
        }),
      })
    }

    /** Invert the selection within the current list. */
    function invertSelectionIn(list) {
      var selected = selectedPathSet()
      selectionStore.set({
        active: true,
        paths: (list || [])
          .map(function (track) {
            return track.path
          })
          .filter(function (path) {
            return selected[path] !== true
          }),
      })
    }

    function beginRangePick() {
      rangePick.active = true
      rangePick.anchor = ''
      selectionStore.set({ active: true })
      showToast(t('v2.rangePickHint'))
    }

    function cancelRangePick() {
      rangePick.active = false
      rangePick.anchor = ''
    }

    /**
     * Click handler for list rows/cards: replace (or toggle with Ctrl), or handle
     * one range pick when the user chose 区域选择.
     */
    function selectTrackIn(list, track, additive) {
      var paths = (list || []).map(function (item) {
        return item.path
      })
      if (rangePick.active) {
        if (rangePick.anchor === '') {
          rangePick.anchor = track.path
          selectionStore.set({ active: true, paths: [track.path] })
          return
        }
        var start = paths.indexOf(rangePick.anchor)
        var end = paths.indexOf(track.path)
        if (start < 0 || end < 0) {
          rangePick.anchor = track.path
          selectionStore.set({ active: true, paths: [track.path] })
          return
        }
        var from = Math.min(start, end)
        var to = Math.max(start, end)
        selectionStore.set({ active: true, paths: paths.slice(from, to + 1) })
        rangePick.active = false
        rangePick.anchor = ''
        return
      }
      var state = selectionStore.get()
      if (additive) {
        if (!state.active) selectionStore.set({ active: true, paths: [track.path] })
        else toggleSelected(track.path)
        return
      }
      if (state.active && state.paths.length === 1 && state.paths[0] === track.path) {
        clearSelection()
        return
      }
      selectionStore.set({ active: true, paths: [track.path] })
    }

    async function batchEditTags(paths, patch) {
      var done = 0
      var failed = 0
      for (var i = 0; i < paths.length; i += 1) {
        try {
          var body = await getJson(API + 'tags?path=' + encodeURIComponent(paths[i]))
          var tags = Object.assign({}, body.tags || {}, patch)
          await sendJson('PUT', API + 'tags', { path: paths[i], tags: tags })
          done += 1
        } catch (error) {
          failed += 1
        }
      }
      return { done: done, failed: failed }
    }

    async function removeTracks(paths) {
      var body = await postJson(API + 'remove', { paths: paths })
      await loadLibrary(true)
      clearSelection()
      return body
    }

    /** Higher bitrate, then higher sample rate, then larger file wins. */
    function compareQuality(left, right) {
      var leftBitrate = Number(left.bitrate) || 0
      var rightBitrate = Number(right.bitrate) || 0
      if (leftBitrate !== rightBitrate) return rightBitrate - leftBitrate
      var leftRate = Number(left.sampleRate) || 0
      var rightRate = Number(right.sampleRate) || 0
      if (leftRate !== rightRate) return rightRate - leftRate
      return (Number(right.size) || 0) - (Number(left.size) || 0)
    }

    /** Same title + artist + rounded duration, at least two entries. */
    function duplicateGroupsOf(tracks) {
      var map = {}
      ;(tracks || []).forEach(function (track) {
        var duration = Math.round(Number(track.durationSec) || 0)
        var title = String(track.title || '').trim().toLowerCase()
        var artist = String(track.artist || '').trim().toLowerCase()
        if (title === '' || duration <= 0) return
        var key = title + '\u0000' + artist + '\u0000' + duration
        if (!map[key]) map[key] = []
        map[key].push(track)
      })
      return Object.keys(map)
        .map(function (key) {
          return map[key]
        })
        .filter(function (group) {
          return group.length > 1
        })
    }

    // ── src/90-theme.js
    /**
     * theme: one plugin-prefixed stylesheet.
     *
     * Every colour is a `--dsw-*` token with a neutral fallback, so the panel
     * follows the host's light/dark theme without hardcoded surfaces.
     */

    var THEME_CSS = [
      // ── shell ───────────────────────────────────────────────────────────────
      '.mp-root :focus-visible{outline:2px solid var(--dsw-focus-ring-color,#4176E6);outline-offset:2px}',
      '.mp-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base,#141417);color:var(--dsw-alias-label-primary,#f4f4f5);font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);font-size:13px;line-height:20px;user-select:none;isolation:isolate}',
      '.mp-root input,.mp-root textarea{user-select:text}',
      '.mp-topbar{display:flex;align-items:center;gap:12px;flex:none;height:48px;padding:0 16px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-1,#15151a)}',
      '.mp-brand{display:flex;align-items:center;gap:8px;font-weight:650;font-size:13.5px;white-space:nowrap}',
      '.mp-brand-link{display:inline-flex;flex:none;border-radius:50%;text-decoration:none;color:inherit}',
      '.mp-brand-link .mp-brand-dot{transition:transform .18s ease,filter .18s ease}',
      '.mp-brand-link:hover .mp-brand-dot{filter:brightness(1.08);transform:translateY(-1px)}',
      '.mp-brand-link:active .mp-brand-dot{transform:scale(.96)}',
      '.mp-brand-link:focus-visible{outline:2px solid var(--dsw-focus-ring-color,#7AAAFF);outline-offset:2px}',
      '.mp-guide-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:86;width:min(1040px,calc(100vw - 32px));height:min(760px,calc(100vh - 64px));display:grid;grid-template-columns:minmax(0,.94fr) minmax(0,1.06fr);grid-template-rows:minmax(0,1fr) auto;overflow:hidden;pointer-events:auto;background:var(--dsw-alias-bg-layer-1,#1b1b1e);border:1px solid var(--dsw-alias-border-l2,#ffffff1f);border-radius:var(--dsw-radius-panel,28px);box-shadow:0 40px 120px rgba(0,0,0,.5);animation:mp-guide-panel-in .34s cubic-bezier(.2,.8,.2,1) both}',
      '@keyframes mp-guide-panel-in{from{opacity:0;transform:translate(-50%,-47%) scale(.985)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',
      '.mp-guide-close{position:absolute;top:14px;right:14px;z-index:6;width:28px;height:28px;display:grid;place-items:center;border:1px solid var(--dsw-alias-border-l1,#ffffff0f);border-radius:50%;background:var(--dsw-alias-bg-layer-2,#1e1e22);color:var(--dsw-alias-label-secondary,#b4b4bd);cursor:pointer;transition:background .15s ease,color .15s ease,transform .15s ease}',
      '.mp-guide-close:hover{background:var(--dsw-alias-interactive-bg-hover,#ffffff14);color:var(--dsw-alias-label-primary,#f4f4f5);transform:rotate(90deg)}',
      '.mp-guide-visual{grid-column:1;grid-row:1/3;position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:22px;background:var(--dsw-static-neutral-bluish-950,#151517);color:var(--dsw-static-neutral-bluish-50,#fff)}',
      '.mp-guide-visual::before{content:"";position:absolute;inset:-30%;z-index:-1;background:radial-gradient(50% 45% at 24% 8%,color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 36%,transparent),transparent 70%),radial-gradient(45% 40% at 86% 24%,color-mix(in srgb,var(--dsw-alias-state-done-primary,#a78bfa) 28%,transparent),transparent 70%),radial-gradient(45% 35% at 50% 110%,color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 18%,transparent),transparent 70%)}',
      '.mp-guide-visual::after{content:"";position:absolute;inset:0;z-index:-1;background-image:linear-gradient(color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 5%,transparent) 1px,transparent 1px);background-size:32px 32px;opacity:.35;pointer-events:none}',
      '.mp-guide-stage-head{position:relative;z-index:2;display:flex;align-items:center;gap:7px;font-size:11px;line-height:16px;letter-spacing:.12em;text-transform:uppercase;color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 62%,transparent)}',
      '.mp-guide-live-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-state-success-primary,#22c55e);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 18%,transparent);animation:mp-guide-pulse 2s ease-in-out infinite}',
      '.mp-guide-stage-format{margin-left:auto;letter-spacing:.1em;color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 38%,transparent)}',
      '@keyframes mp-guide-pulse{0%,100%{opacity:.45}50%{opacity:1}}',
      '.mp-guide-watermark{position:absolute;left:18px;right:18px;bottom:14px;z-index:0;font-size:clamp(76px,10vw,124px);line-height:1;font-weight:800;letter-spacing:-.06em;white-space:nowrap;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 12%,transparent);pointer-events:none;opacity:.65}',
      '.mp-guide-shot{position:relative;z-index:1;width:min(320px,86%);margin:auto;border-radius:var(--dsw-radius-xl,20px);overflow:hidden;border:1px solid color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 14%,transparent);box-shadow:0 24px 60px rgba(0,0,0,.45);background:var(--dsw-static-neutral-bluish-950,#151517)}.mp-guide-shot img{display:block;width:100%;height:auto}.mp-guide-shot::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 8%,transparent);pointer-events:none}.mp-guide-preview{position:relative;z-index:1;width:min(340px,92%);margin:auto;box-sizing:border-box;padding:16px;display:flex;flex-direction:column;gap:10px;border:1px solid color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 12%,transparent);border-radius:20px;background:color-mix(in srgb,var(--dsw-static-neutral-bluish-950,#151517) 72%,transparent);box-shadow:0 24px 60px rgba(0,0,0,.42)}.mp-guide-preview-top{display:flex;align-items:center;gap:7px;font-size:11px;line-height:16px;letter-spacing:.12em;text-transform:uppercase;color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 62%,transparent)}.mp-guide-preview .mp-guide-art{width:min(210px,76%);margin:2px auto 0}.mp-guide-preview-meta{min-width:0;text-align:center}.mp-guide-preview-title{font-size:16px;line-height:22px;font-weight:650;color:var(--dsw-static-neutral-bluish-50,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mp-guide-preview-artist{font-size:11px;line-height:16px;color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 52%,transparent);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mp-guide-preview-lyric{min-width:0;text-align:center}.mp-guide-preview-lyric-main{font-size:13px;line-height:20px;color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 78%,transparent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mp-guide-preview-lyric-sub{font-size:11px;line-height:16px;letter-spacing:.1em;color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 38%,transparent);margin-top:2px}.mp-guide-preview-wave{display:flex;align-items:flex-end;justify-content:center;gap:3px;height:18px;opacity:.9}.mp-guide-preview-wave i{width:2px;border-radius:2px;background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 90%,white),var(--dsw-alias-state-business-primary,#7aaaff));transform-origin:50% 100%;animation:mp-guide-wave 1.4s ease-in-out infinite alternate}.mp-guide-preview-progress{display:flex;flex-direction:column;gap:4px}.mp-guide-preview-track{position:relative;height:3px;border-radius:2px;background:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 16%,transparent)}.mp-guide-preview-track i{display:block;height:100%;border-radius:2px;background:var(--dsw-alias-state-business-primary,#7aaaff)}.mp-guide-preview-thumb{position:absolute;top:50%;width:8px;height:8px;border-radius:50%;background:var(--dsw-static-neutral-bluish-50,#fff);transform:translate(-50%,-50%);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 55%,transparent)}.mp-guide-preview-times{display:flex;justify-content:space-between;font-size:11px;line-height:16px;color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 46%,transparent)}.mp-guide-preview-controls{display:flex;align-items:center;justify-content:center;gap:16px;padding-top:2px}.mp-guide-ctrl{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 10%,transparent);color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 78%,transparent)}.mp-guide-ctrl.is-main{width:38px;height:38px;background:var(--dsw-static-neutral-bluish-50,#fff);color:var(--dsw-static-neutral-bluish-950,#151517)}.mp-guide-art{position:relative;z-index:1;width:min(270px,72%);aspect-ratio:1;margin:auto;display:grid;place-items:center}.mp-guide-art::before{content:"";position:absolute;inset:-20%;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 24%,transparent),transparent 70%);pointer-events:none;z-index:-1}.mp-guide-cover{position:relative;width:100%;height:100%;border-radius:20px;overflow:hidden;background:var(--dsw-static-neutral-bluish-900,#1b1b1c);border:1px solid color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 16%,transparent);box-shadow:0 30px 60px rgba(0,0,0,.5);transform:rotate(-1.8deg)}.mp-guide-cover img{width:100%;height:100%;object-fit:cover;display:block}.mp-guide-cover::after{content:"";position:absolute;inset:0;background:linear-gradient(140deg,rgba(255,255,255,.18),transparent 38%,transparent 62%,rgba(0,0,0,.18));pointer-events:none}.mp-guide-visual.is-square .mp-guide-vinyl-wrap{display:none}.mp-guide-visual.is-vinyl .mp-guide-cover{display:none}.mp-guide-vinyl-wrap{position:relative;width:100%;aspect-ratio:1;display:grid;place-items:center}',
      '.mp-guide-vinyl-wrap::before{content:"";position:absolute;inset:-14px;border-radius:50%;border:1px dashed color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 14%,transparent);animation:mp-guide-orbit 30s linear infinite reverse}',
      '.mp-guide-vinyl{position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:repeating-radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 8%,transparent) 0 1px,transparent 1px 5px),radial-gradient(circle at 38% 30%,color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 12%,transparent),transparent 45%),var(--dsw-static-neutral-bluish-950,#151517);box-shadow:0 30px 60px rgba(0,0,0,.55),inset 0 0 0 1px color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 14%,transparent)}',
      '.mp-guide-vinyl-sheen{position:absolute;inset:-18%;background:conic-gradient(from 0deg,transparent 0 34%,color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 26%,transparent) 50%,transparent 64% 100%);animation:mp-guide-spin 18s linear infinite;opacity:.55;pointer-events:none}',
      '.mp-guide-vinyl-label{position:relative;z-index:2;width:38%;aspect-ratio:1;border-radius:50%;overflow:hidden;padding:3px;background:var(--dsw-alias-bg-layer-2,#1e1e22);border:1px solid color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 20%,transparent);box-shadow:0 4px 16px rgba(0,0,0,.45)}',
      '.mp-guide-vinyl-label img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}',
      '@keyframes mp-guide-orbit{to{transform:rotate(360deg)}}',
      '@keyframes mp-guide-spin{to{transform:rotate(360deg)}}',
      '.mp-guide-stage-wave{position:absolute;left:24px;right:24px;bottom:104px;z-index:1;height:46px;display:flex;align-items:flex-end;gap:3px;opacity:.9}',
      '.mp-guide-stage-wave i{flex:1;min-width:2px;border-radius:2px;background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 88%,white),var(--dsw-alias-state-business-primary,#7aaaff));opacity:.85;transform-origin:50% 100%;animation:mp-guide-wave 1.4s ease-in-out infinite alternate}@keyframes mp-guide-wave{from{transform:scaleY(.55);opacity:.55}to{transform:scaleY(1);opacity:.95}}',
      '.mp-guide-float{position:absolute;left:24px;right:24px;bottom:24px;z-index:2;display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 12%,transparent);border-radius:12px;background:color-mix(in srgb,var(--dsw-static-neutral-bluish-950,#151517) 76%,transparent);color:var(--dsw-static-neutral-bluish-50,#fff);box-shadow:0 14px 32px rgba(0,0,0,.32)}',
      '.mp-guide-float-icon{display:inline-flex;flex:none;color:var(--dsw-alias-state-business-primary,#7aaaff)}',
      '.mp-guide-float-text{min-width:0}',
      '.mp-guide-float-lyric{font-size:13px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mp-guide-float-meta{font-size:11px;line-height:16px;letter-spacing:.1em;color:color-mix(in srgb,var(--dsw-static-neutral-bluish-50,#fff) 48%,transparent);margin-top:1px}',
      '.mp-guide-content{grid-column:2;grid-row:1;display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-layer-1,#1b1b1e)}',
      '.mp-guide-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:34px 36px 18px;scrollbar-width:thin;display:flex;flex-direction:column}',
      '.mp-guide-eyebrow{display:flex;align-items:center;gap:8px;font-size:11px;line-height:16px;letter-spacing:.16em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-guide-eyebrow::before{content:"";width:18px;height:1px;background:var(--dsw-alias-state-business-primary,#7aaaff);opacity:.85}',
      '.mp-guide-title{margin-top:14px;max-width:430px;font-size:30px;line-height:38px;font-weight:650;letter-spacing:-.02em;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-guide-tagline{margin-top:8px;max-width:440px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#b4b4bd)}',
      '.mp-guide-list{display:flex;flex-direction:column;margin-top:18px}',
      '.mp-guide-row{display:flex;align-items:flex-start;gap:10px;padding:11px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#ffffff0f);animation:mp-guide-row-in .42s cubic-bezier(.2,.8,.2,1) both}',
      '.mp-guide-row:last-child{border-bottom:0}.mp-guide-row:nth-child(1){animation-delay:.05s}.mp-guide-row:nth-child(2){animation-delay:.1s}.mp-guide-row:nth-child(3){animation-delay:.15s}.mp-guide-row:nth-child(4){animation-delay:.2s}@keyframes mp-guide-row-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
      '.mp-guide-row-icon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex:none;margin-top:1px;background:color-mix(in srgb,var(--mp-guide-accent) 14%,transparent);color:var(--mp-guide-accent)}',
      '.mp-guide-row-main{min-width:0;flex:1}',
      '.mp-guide-row-title{font-size:13px;line-height:20px;font-weight:650;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-guide-row-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:1px}',
      '.mp-guide-row-index{flex:none;margin-top:2px;font-size:11px;line-height:16px;letter-spacing:.08em;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums}',
      '.mp-guide-warning-card{display:flex;gap:9px;width:100%;box-sizing:border-box;margin-top:14px;padding:11px 12px;border:1px solid var(--dsw-alias-border-l1,#ffffff0f);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f25a5a) 34%,transparent);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#1e1e22);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f25a5a) 8%,transparent)}',
      '.mp-guide-warning-card svg{flex:none;color:var(--dsw-alias-state-error-primary,#f25a5a);margin-top:1px}',
      '.mp-guide-warning-title{font-size:12px;line-height:18px;font-weight:650;color:var(--dsw-alias-state-error-primary,#f25a5a)}',
      '.mp-guide-warning-text{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,#f25a5a);margin-top:3px}.mp-guide-style{margin-top:14px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1,#ffffff0f)}.mp-guide-style-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#b4b4bd)}.mp-guide-style-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93)}.mp-guide-style-options{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.mp-guide-style-option{display:flex;align-items:center;gap:8px;min-width:0;padding:7px 8px;border:1px solid var(--dsw-alias-border-l1,#ffffff0f);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#1e1e22);color:var(--dsw-alias-label-secondary,#b4b4bd);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer;transition:border-color .15s ease,background .15s ease,color .15s ease}.mp-guide-style-option:hover{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 28%,var(--dsw-alias-border-l1,#ffffff0f))}.mp-guide-style-option.is-on{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 46%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#7aaaff) 9%,transparent);color:var(--dsw-alias-label-primary,#f4f4f5)}.mp-guide-style-thumb{width:34px;height:34px;flex:none;overflow:hidden;background:var(--dsw-alias-bg-layer-3,#232324);border:1px solid var(--dsw-alias-border-l1,#ffffff0f)}.mp-guide-style-thumb.is-square{border-radius:8px}.mp-guide-style-thumb.is-vinyl{border-radius:50%;box-shadow:0 0 0 3px var(--dsw-alias-bg-layer-3,#232324),0 0 0 4px var(--dsw-alias-border-l1,#ffffff0f)}.mp-guide-style-thumb img{width:100%;height:100%;object-fit:cover;display:block}.mp-guide-style-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mp-guide-style-check{margin-left:auto;display:inline-flex;flex:none;color:var(--dsw-alias-state-business-primary,#7aaaff)}.mp-guide-signature{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:20px;font-size:11px;line-height:16px;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8a93)}.mp-guide-signature-rule{height:1px;flex:1;background:var(--dsw-alias-border-l1,#ffffff0f)}',
      '.mp-guide-footer{grid-column:2;grid-row:2;z-index:5;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:12px 36px 14px;border-top:1px solid var(--dsw-alias-border-l1,#ffffff0f);background:var(--dsw-alias-bg-layer-1,#1b1b1e);flex-wrap:wrap}',
      '.mp-guide-check{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer}',
      '.mp-guide-check-text{border:0;background:transparent;padding:0;font:inherit;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;text-align:left}',
      '.mp-guide-check-text:hover{color:var(--dsw-alias-label-secondary,#b4b4bd)}',
      '.mp-guide-action{display:flex;flex-direction:column;align-items:stretch;gap:5px;flex:1 1 160px;min-width:160px;max-width:220px;margin-left:auto}',
      '.mp-guide-progress{height:2px;border-radius:2px;background:var(--dsw-alias-border-l1,#ffffff0f);overflow:hidden}',
      '.mp-guide-progress i{display:block;height:100%;border-radius:2px;background:var(--dsw-alias-state-business-primary,#7aaaff);transition:width 1s linear}',
      '.mp-guide-action .mp-btn{width:100%;justify-content:center}',
      '.mp-guide-action .mp-btn[disabled]{opacity:.55;cursor:default}',
      '@media (max-width:860px){.mp-guide-panel{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr) auto;width:calc(100vw - 16px);height:min(92vh,820px)}.mp-guide-visual{grid-column:1;grid-row:1;height:300px;padding:14px}.mp-guide-preview{width:min(300px,94%);padding:12px;gap:7px}.mp-guide-shot{width:150px;border-radius:var(--dsw-radius-lg,16px)}.mp-guide-preview .mp-guide-art{width:120px}.mp-guide-preview-title{font-size:14px}.mp-guide-preview-lyric,.mp-guide-preview-wave{display:none}.mp-guide-watermark{font-size:64px;bottom:8px;opacity:.45}.mp-guide-stage-wave{left:16px;right:16px;bottom:78px;height:28px}.mp-guide-float{left:16px;right:16px;bottom:14px;padding:8px 10px}.mp-guide-float-meta{display:none}.mp-guide-scroll{padding:20px 20px 14px}.mp-guide-title{font-size:24px;line-height:30px;margin-top:10px}.mp-guide-content{grid-column:1;grid-row:2}.mp-guide-footer{grid-column:1/-1;grid-row:3;padding:10px 16px 12px}.mp-guide-close{top:10px;right:10px}}',
      '@media (prefers-reduced-motion:reduce){.mp-guide-panel,.mp-guide-vinyl-wrap::before,.mp-guide-vinyl-sheen,.mp-guide-live-dot,.mp-guide-stage-wave i,.mp-guide-row{animation:none}}',
      '@keyframes mp-guide-panel-in{from{opacity:0;transform:translate(-50%,-48%) scale(.985)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',
      '@keyframes mp-guide-orbit{to{transform:rotate(360deg)}}',
      '.mp-brand-dot{width:30px;height:30px;flex:none;border-radius:50%;display:grid;place-items:center;overflow:hidden;padding:2px;background:linear-gradient(135deg,#9CC3FF,#4169E1);box-shadow:0 2px 8px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176E6) 42%,transparent),inset 0 0 0 1px rgba(255,255,255,.28)}',
      '.mp-brand-logo{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}',
      '.mp-src-tabs{display:flex;gap:2px;padding:3px;border-radius:12px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));min-width:0;overflow-x:auto;scrollbar-width:none}', '.mp-src-tabs::-webkit-scrollbar{display:none}', '.mp-src-tab{flex:none}',
      '.mp-src-tab{height:26px;padding:0 11px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;cursor:pointer;white-space:nowrap}',
      '.mp-src-tab:hover{color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-src-tab.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600}',
      '.mp-search{position:relative;width:220px;margin-left:auto;flex:none}',
      '.mp-search svg{position:absolute;left:10px;top:9px;color:var(--dsw-alias-label-tertiary,#8a8a93);pointer-events:none}',
      '.mp-search-input{width:100%;height:32px;padding:0 10px 0 31px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font:inherit;font-size:13px;outline:none}',
      '.mp-search-input::placeholder{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-search-input:focus{border-color:var(--dsw-alias-state-business-primary,#4176E6);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 16%, transparent)}',
      '.mp-userchip{display:none;align-items:center;gap:6px;height:26px;padding:0 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);white-space:nowrap}',
      '.mp-userchip.is-on{display:inline-flex}',
      '.mp-userchip-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4176E6)}',

      '.mp-userchip-name{max-width:150px;overflow:hidden;text-overflow:ellipsis}',
      '.mp-userchip-vip{font-size:9px;font-weight:700;line-height:1;padding:2px 5px;border-radius:8px;letter-spacing:.02em}',
      '.mp-userchip-vip.is-on{color:#8a5a00;background:#ffd76a}',
      '.mp-userchip-out{color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;margin-left:2px}',
      '.mp-userchip-out:hover{color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-iconbtn{width:30px;height:30px;display:inline-grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer;flex:none}',
      '.mp-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-iconbtn.is-on{color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-btn{height:30px;padding:0 12px;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:8px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.05));color:var(--dsw-alias-label-primary,#f4f4f5);font-size:13px;cursor:pointer;white-space:nowrap}',
      '.mp-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-btn.is-primary{background:var(--dsw-alias-button-primary-fill,#0f1115);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}',
      '.mp-btn.is-primary:hover{background:var(--dsw-alias-button-primary-hover,#232324)}',
      '.mp-btn.is-ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mp-btn.is-ghost:hover{color:var(--dsw-alias-label-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-btn:disabled{opacity:.5;cursor:default}',

      // ── workspace ───────────────────────────────────────────────────────────
      '.mp-workspace{display:grid;grid-template-columns:188px minmax(0,1fr);flex:1;min-height:0}',
      '.mp-workspace.is-queue{grid-template-columns:188px minmax(0,1fr) 304px}',
      '.mp-root.is-top .mp-workspace,.mp-root.is-top .mp-workspace.is-queue{grid-template-columns:minmax(0,1fr)}',
      '.mp-root.is-top .mp-workspace.is-queue{grid-template-columns:minmax(0,1fr) 304px}',
      '.mp-root.is-top .mp-nav{display:none}',
      '.mp-nav{display:flex;flex-direction:column;gap:16px;min-height:0;overflow-y:auto;padding:12px 8px;border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-nav-group{display:flex;flex-direction:column;gap:1px}',
      '.mp-nav-label{padding:0 10px 6px;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8a93);font-weight:600}',
      '.mp-nav-item{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;cursor:pointer;text-align:left;min-width:0}',
      '.mp-nav-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-nav-item.is-on{background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 13%, transparent);color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600;box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-nav-item span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-nav-count{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums}',
      '.mp-sectionbar{display:none;align-items:center;gap:2px;flex:none;height:40px;padding:0 18px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));overflow-x:auto;scrollbar-width:none}',
      '.mp-sectionbar::-webkit-scrollbar{display:none}',
      '.mp-root.is-top .mp-sectionbar{display:flex}',
      '.mp-sec-item{height:26px;padding:0 9px;display:inline-flex;align-items:center;gap:6px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;cursor:pointer;white-space:nowrap}',
      '.mp-sec-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-sec-item.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600}',
      '.mp-sec-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums}',
      '.mp-sec-sep{flex:none;width:1px;height:14px;background:var(--dsw-alias-border-l2,rgba(255,255,255,.14));margin:0 6px}',
      '.mp-sec-spacer{margin-left:auto}',
      '.mp-sec-actions{display:inline-flex;align-items:center;gap:4px;flex:none}',

      // ── content ─────────────────────────────────────────────────────────────
      '.mp-content{display:flex;flex-direction:column;min-width:0;min-height:0}',

      '.mp-sec-overflow{position:relative;display:inline-flex;flex:none;margin-left:auto}',
      '.mp-sec-expand{height:26px;padding:0 9px;display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;cursor:pointer;white-space:nowrap}',
      '.mp-sec-expand:hover,.mp-sec-expand.is-on{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-playlist-pop{position:fixed;z-index:60;padding:12px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:16px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-panel,0 20px 56px rgba(0,0,0,.5));max-height:70vh;overflow:auto}',
      '.mp-playlist-pop-head{display:flex;align-items:baseline;gap:8px;padding:2px 2px 10px;font-size:13px}',
      '.mp-playlist-pop-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-playlist-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '.mp-playlist-card{display:flex;align-items:center;gap:9px;min-width:0;min-height:58px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.035));color:var(--dsw-alias-label-primary,#f4f4f5);text-align:left;cursor:pointer}',
      '.mp-playlist-card:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.14))}',
      '.mp-playlist-card.is-on{border-color:var(--dsw-alias-state-business-primary,#4176E6);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176E6) 12%,transparent)}',
      '.mp-playlist-card-icon{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;flex:none;overflow:hidden;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08));color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mp-playlist-card-icon img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mp-playlist-card-main{display:flex;flex-direction:column;min-width:0;gap:2px}',
      '.mp-playlist-card-main strong{font-size:12px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-playlist-card-main span{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '@media (max-width:900px){.mp-playlist-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media (max-width:620px){.mp-playlist-grid{grid-template-columns:1fr}}',
      '.mp-content-head{display:flex;align-items:center;gap:12px;padding:10px 22px 6px;min-height:0;flex:none}',
      '.mp-title{margin:0;font-size:20px;font-weight:650;letter-spacing:-.015em;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-count{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);padding-bottom:3px;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.mp-sel-count{margin-left:2px;padding:2px 9px;border-radius:999px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-business-primary,#7AAAFF);background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 12%, transparent)}',
      '.mp-head-actions{margin-left:auto;display:flex;align-items:center;gap:6px;flex:none}',
      '.mp-toolbar{display:flex;align-items:center;gap:8px;padding:0 22px 10px;min-height:34px;flex-wrap:wrap;flex:none}',
      '.mp-toolbar-left{display:flex;align-items:center;gap:8px;margin-right:auto}',
      '.mp-toolbar-right{display:flex;align-items:center;gap:8px}',
      '.mp-online-auth{display:flex;align-items:flex-start;gap:10px;margin:0 22px 10px;padding:10px 12px;border:1px solid rgba(240,179,91,.35);border-radius:8px;background:rgba(240,179,91,.08);flex:none}',
      '.mp-online-auth-icon{display:flex;flex:none;color:#f0b35b;margin-top:1px}',
      '.mp-online-auth-text{flex:1;min-width:0}',
      '.mp-online-auth-title{font-size:12px;font-weight:650;color:rgba(255,224,180,.95)}',
      '.mp-online-auth-hint{margin-top:2px;font-size:11px;line-height:1.45;color:rgba(255,255,255,.6)}',
      '.mp-online-auth-actions{display:flex;align-items:center;gap:6px;flex:none;margin-top:1px}',
      '.mp-online-auth-btn{height:26px;padding:0 9px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);font:inherit;font-size:11px;cursor:pointer}',
      '.mp-online-auth-btn:hover{background:rgba(255,255,255,.12)}',
      '.mp-online-auth-btn.is-primary{background:#e6a85a;border-color:#e6a85a;color:#241708}',
      '.mp-online-auth-btn.is-primary:hover{background:#f0b86a;border-color:#f0b86a}',
      '@media (max-width:700px){.mp-online-auth{flex-wrap:wrap}.mp-online-auth-actions{width:100%;justify-content:flex-end}}',
      '.mp-toolbar:empty{display:none}',
      '.mp-chip{height:26px;padding:0 10px;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;cursor:pointer;white-space:nowrap}',
      '.mp-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-chip.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.14))}',
      '.mp-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:0 12px 18px;outline:none}',
      '.mp-vlist-inner{position:relative;width:100%}',
      '.mp-vlist-row{position:absolute;left:0;right:0}',
      '.mp-vlist-row > .mp-row{width:100%;height:100%}',
      '.mp-filterbar{display:flex;align-items:center;gap:8px;padding:0 22px 8px;flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',

      // ── rows ────────────────────────────────────────────────────────────────
      '.mp-row{display:grid;box-sizing:border-box;grid-template-columns:48px minmax(0,1.6fr) minmax(0,1fr) 80px 52px 58px;align-items:center;gap:12px;height:72px;padding:0 12px;border-radius:8px;color:var(--dsw-alias-label-primary,#f4f4f5);position:relative;cursor:default}',
      '.mp-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-row.is-cur{background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 12%, transparent)}',
      '.mp-row.is-selected{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}',
      '.mp-row.is-cur.is-selected{background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 18%, transparent)}',
      '.mp-row.is-cur::before{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);width:3px;height:26px;border-radius:2px;background:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-row-cover{position:relative;width:48px;height:48px;border-radius:8px;overflow:hidden;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#8a8a93);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(255,255,255,.06))}',
      '.mp-row-cover img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mp-row.is-round .mp-row-cover{border-radius:50%}',
      '.mp-cover-play{position:absolute;inset:0;display:grid;place-items:center;border:0;padding:0;font:inherit;cursor:pointer;background:rgba(0,0,0,.5);opacity:0;transition:opacity .12s;color:#fff}',
      '.mp-row:hover .mp-cover-play{opacity:1}',
      '.mp-row-main{min-width:0}',
      '.mp-row-title{font-size:15px;font-weight:550;line-height:21px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:6px}',
      '.mp-row.is-cur .mp-row-title{color:var(--dsw-alias-state-business-primary,#7AAAFF)}',
      '.mp-row-sub{font-size:13px;line-height:18px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-row-album{font-size:13px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-album-link{max-width:100%;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-album-link:hover{color:var(--dsw-alias-state-business-primary,#4176E6);text-decoration:underline}',
      '.mp-artist-link{max-width:100%;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-artist-link:hover{color:var(--dsw-alias-state-business-primary,#4176E6);text-decoration:underline}',
      '.mp-artist-piece{display:inline}',
      '.mp-row-sub-album{display:none}',
      '@media (max-width:1080px){.mp-row-sub-album{display:inline}}',
      '.mp-row-time{font-size:13px;color:var(--dsw-alias-label-tertiary,#8a8a93);text-align:right;font-variant-numeric:tabular-nums}',
      '.mp-row-acts{display:flex;align-items:center;justify-content:flex-end;gap:2px}',
      '.mp-row-acts .mp-iconbtn{width:30px;height:30px;opacity:0}',
      '.mp-row-acts .mp-fav{opacity:.55}',
      '.mp-row:hover .mp-row-acts .mp-fav,.mp-row-acts .mp-fav.is-on{opacity:1}',
      '.mp-row:hover .mp-row-acts .mp-iconbtn,.mp-row-acts .mp-iconbtn.is-on{opacity:1}',
      '.mp-badge{display:inline-flex;align-items:center;height:15px;padding:0 5px;border-radius:4px;font-size:9.5px;font-weight:700;letter-spacing:.02em;line-height:1;flex:none}',
      '.mp-badge.is-vip{color:#1a1405;background:linear-gradient(180deg,#ffd76e,#f2b62e)}',
      '.mp-badge.is-cache{color:var(--dsw-alias-label-secondary,#a1a1aa);background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));padding:0 4px}',
      '.mp-eq{display:inline-flex;align-items:flex-end;gap:2px;height:11px;flex:none}',
      '.mp-eq i{width:2px;background:var(--dsw-alias-state-business-primary,#4176E6);border-radius:1px;animation:mp-eq .9s ease-in-out infinite}',
      '.mp-eq i:nth-child(2){animation-delay:.18s}',
      '.mp-eq i:nth-child(3){animation-delay:.36s}',
      '@keyframes mp-eq{0%,100%{height:3px}50%{height:11px}}',

      // ── grid / simple rows / stats ──────────────────────────────────────────
      '.mp-srow{display:flex;align-items:center;box-sizing:border-box;gap:12px;height:64px;padding:0 12px;border-radius:8px;cursor:pointer;color:inherit;background:transparent;border:0;width:100%;text-align:left;font:inherit}',
      '.mp-srow:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-srow-cover{width:48px;height:48px;border-radius:8px;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#8a8a93);flex:none;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));overflow:hidden}',
      '.mp-srow-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-srow-cover.is-round{border-radius:50%}',
      '.mp-srow-main{min-width:0;flex:1}',
      '.mp-srow-title{font-size:14px;line-height:19px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-srow-sub{font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-srow-meta{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums;flex:none}',
      '.mp-stat-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;padding:6px 10px 16px}',
      '.mp-stat-card{padding:14px 16px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))}',
      '.mp-stat-k{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-stat-v{font-size:22px;font-weight:650;margin-top:6px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
      '.mp-rank{padding:0 10px}',
      '.mp-rank-row{display:grid;grid-template-columns:26px 34px minmax(0,1fr) 90px 74px;gap:10px;align-items:center;height:48px;border-radius:8px;padding:0 6px;cursor:pointer}',
      '.mp-rank-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-rank-n{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);text-align:center;font-variant-numeric:tabular-nums}',
      '.mp-rank-c{width:28px;height:28px;border-radius:8px;overflow:hidden;display:grid;place-items:center;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07))}',
      '.mp-rank-c img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mp-rank-m{min-width:0}',
      '.mp-rank-bar{height:4px;border-radius:2px;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));overflow:hidden}',
      '.mp-rank-bar i{display:block;height:100%;background:var(--dsw-alias-state-business-primary,#4176E6);border-radius:2px}',
      '.mp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:64px 20px;color:var(--dsw-alias-label-tertiary,#8a8a93);text-align:center}',
      '.mp-empty strong{color:var(--dsw-alias-label-secondary,#a1a1aa);font-weight:600;font-size:13px}',
      '.mp-empty span{font-size:12px;max-width:44ch}',
      '.mp-spinner{width:18px;height:18px;border-radius:50%;border:2px solid var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12));border-top-color:var(--dsw-alias-state-business-primary,#4176E6);animation:mp-spin .8s linear infinite}',
      '@keyframes mp-spin{to{transform:rotate(360deg)}}',

      // ── player bar ──────────────────────────────────────────────────────────
      '.mp-playerbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);align-items:center;gap:16px;flex:none;height:68px;padding:0 14px;position:relative;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-1,#15151a);box-shadow:0 -10px 30px rgba(0,0,0,.08)}',
      '.mp-pb-track{display:flex;align-items:center;gap:12px;min-width:0;padding-right:4px;overflow:hidden}',
      '.mp-pb-cover{position:relative;width:40px;height:40px;border-radius:8px;display:grid;place-items:center;flex:none;color:var(--dsw-alias-label-tertiary,#8a8a93);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2),inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(255,255,255,.06));transition:transform .16s,box-shadow .16s}',
      '.mp-pb-cover:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.26),inset 0 0 0 1px var(--dsw-alias-border-l2,rgba(255,255,255,.1))}',
      '.mp-pb-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-pb-eq{position:absolute;right:5px;bottom:5px;display:flex;align-items:flex-end;gap:2px;padding:3px 4px;border-radius:8px;background:rgba(0,0,0,.52);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);pointer-events:none}',
      '.mp-pb-eq i{width:2px;height:4px;border-radius:2px;background:#fff;animation:mp-eq .9s ease-in-out infinite}',
      '.mp-pb-eq i:nth-child(2){animation-delay:.15s}',
      '.mp-pb-eq i:nth-child(3){animation-delay:.3s}',
      '@keyframes mp-eq{0%,100%{height:4px}50%{height:10px}}',
      '@media (prefers-reduced-motion:reduce){.mp-pb-eq i{animation:none;height:7px}}',
      '.mp-pb-meta{min-width:0;flex:0 1 auto;display:flex;flex-direction:column;justify-content:center;gap:1px}',
      '.mp-pb-title{font-size:13px;font-weight:600;line-height:18px;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-pb-artist{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-pb-fav{opacity:.55;margin-left:2px;transition:opacity .12s}',
      '.mp-fav.is-on,.mp-pb-fav.is-on{color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mp-fav.is-on{opacity:1}',
      '.mp-pb-track:hover .mp-pb-fav,.mp-pb-fav.is-on,.mp-pb-fav:focus-visible{opacity:1}',
      '.mp-pb-center{display:flex;flex-direction:column;gap:0;min-width:0;width:100%;max-width:580px;margin:0 auto}',
      '.mp-pb-controls{display:flex;align-items:center;justify-content:center;gap:6px}',
      '.mp-pb-controls .mp-iconbtn{width:30px;height:30px}',
      '.mp-pb-play{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:0;background:var(--dsw-alias-label-primary,#f4f4f5);color:var(--dsw-alias-bg-base,#141417);cursor:pointer;margin:0 6px;flex:none;box-shadow:0 4px 14px rgba(0,0,0,.22);transition:transform .14s,box-shadow .14s,background .14s}',
      '.mp-pb-play:hover{transform:scale(1.06);box-shadow:0 8px 22px rgba(0,0,0,.28)}',
      '.mp-pb-play:active{transform:scale(.96)}',
      '.mp-pb-play:disabled{opacity:.4;transform:none;box-shadow:none}',

      '.mp-time{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums;width:38px;text-align:center;flex:none;transition:color .12s}',
      '.mp-time.is-preview{color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-seek{position:relative;flex:1;height:18px;display:flex;align-items:center;min-width:0;cursor:pointer}',
      '.mp-seek::before{content:\'\';position:absolute;left:0;right:0;top:50%;height:3px;transform:translateY(-50%);border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#f4f4f5) 16%,transparent);pointer-events:none;transition:height .16s,background .16s}',
      '.mp-seek-buffer{position:absolute;left:0;top:50%;height:3px;transform:translateY(-50%);border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#f4f4f5) 24%,transparent);pointer-events:none;transition:height .16s,width .2s}',
      '.mp-seek::after{content:\'\';position:absolute;left:0;top:50%;height:3px;width:var(--mp-p,0%);transform:translateY(-50%);border-radius:999px;background:linear-gradient(90deg,var(--dsw-alias-state-business-primary,#4176E6),#8bd0ff);pointer-events:none;transition:height .16s}',
      '.mp-seek:hover::before,.mp-seek:hover::after,.mp-seek:hover .mp-seek-buffer{height:4px}',
      '.mp-seek input{-webkit-appearance:none;appearance:none;position:relative;z-index:2;width:100%;height:18px;margin:0;background:transparent;cursor:pointer}',
      '.mp-seek input::-webkit-slider-runnable-track{height:18px;background:transparent}',
      '.mp-seek input::-moz-range-track{height:18px;background:transparent}',
      '.mp-seek input::-moz-range-progress{background:transparent}',
      '.mp-seek input::-webkit-slider-thumb{-webkit-appearance:none;width:9px;height:9px;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);margin-top:4.5px;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#15151a),0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176E6) 22%,transparent),0 2px 7px rgba(0,0,0,.28);opacity:.88;transition:width .12s,height .12s,opacity .12s,transform .12s}',
      '.mp-seek:hover input::-webkit-slider-thumb,.mp-seek input:focus-visible::-webkit-slider-thumb,.mp-seek input:active::-webkit-slider-thumb{width:12px;height:12px;margin-top:3px;opacity:1;transform:scale(1.05)}',
      '.mp-seek input::-moz-range-thumb{width:9px;height:9px;border:0;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#15151a),0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176E6) 22%,transparent);opacity:.88;transition:width .12s,height .12s,opacity .12s}',
      '.mp-seek:hover input::-moz-range-thumb,.mp-seek input:focus-visible::-moz-range-thumb,.mp-seek input:active::-moz-range-thumb{width:12px;height:12px;opacity:1}',
      '.mp-pb-right{display:flex;align-items:center;justify-content:flex-end;gap:4px}',
      '.mp-pb-right .mp-iconbtn{width:30px;height:30px}',
      '.mp-pb-vol{display:flex;align-items:center;gap:6px;width:98px;margin:0 4px 0 2px;flex:none}',
      '.mp-pb-vol input{width:64px;height:16px;-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer}',
      '.mp-pb-vol input::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:linear-gradient(90deg,var(--dsw-alias-label-secondary,#a1a1aa) var(--mp-v,60%),var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12)) var(--mp-v,60%))}',
      '.mp-pb-vol input::-moz-range-track{height:3px;border-radius:2px;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12))}',
      '.mp-pb-vol input::-moz-range-progress{height:3px;border-radius:2px;background:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mp-pb-vol input::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);margin-top:-3px;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#15151a);opacity:0;transition:opacity .12s}',
      '.mp-pb-vol:hover input::-webkit-slider-thumb,.mp-pb-vol input:focus-visible::-webkit-slider-thumb{opacity:1}',
      '.mp-pb-vol input::-moz-range-thumb{width:10px;height:10px;border:0;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);opacity:0}',
      '.mp-pb-vol:hover input::-moz-range-thumb,.mp-pb-vol input:focus-visible::-moz-range-thumb{opacity:1}',
      '.mp-playerbar.is-empty .mp-pb-cover{box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(255,255,255,.06))}',
      '.mp-playerbar.is-empty .mp-pb-play{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));color:var(--dsw-alias-label-tertiary,#8a8a93);box-shadow:none}',

      // ── queue (side panel and floating variant) ─────────────────────────────
      '.mp-queue{display:none;flex-direction:column;min-height:0;border-left:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-1,#15151a)}',
      '.mp-workspace.is-queue .mp-queue{display:flex}',
      '.mp-q-head{display:flex;align-items:center;gap:8px;padding:14px 12px 8px;flex:none}',
      '.mp-q-title{font-size:13px;font-weight:650}',
      '.mp-q-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-q-list{flex:1;min-height:0;overflow-y:auto;padding:0 6px 14px}',
      '.mp-q-row{display:flex;align-items:center;gap:10px;height:52px;padding:0 9px;border-radius:8px;cursor:grab;font-size:13px;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-q-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-q-row.is-cur{background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 12%, transparent)}',
      '.mp-q-row.is-cur .mp-q-name{color:var(--dsw-alias-state-business-primary,#7AAAFF)}',
      '.mp-q-idx{width:18px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);text-align:center;font-variant-numeric:tabular-nums;flex:none}',
      '.mp-q-wave{display:inline-flex;align-items:flex-end;justify-content:center;gap:1px;width:14px;height:14px;vertical-align:middle}',
      '.mp-q-wave i{width:2px;min-height:2px;border-radius:1px;background:linear-gradient(180deg,#9cbcff,#4d7dff);transition:height .07s linear}',
      '.mp-q-cover{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;flex:none;color:var(--dsw-alias-label-tertiary,#8a8a93);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));overflow:hidden}',
      '.mp-q-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-q-main{min-width:0;flex:1}',
      '.mp-q-name{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-q-artist{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-queue-pop{position:fixed;right:24px;bottom:96px;z-index:70;width:340px;max-height:56vh;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:16px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:0 16px 48px rgba(0,0,0,.5);overflow:hidden}',
      '.mp-queue-pop .mp-q-list{max-height:40vh}',

      // ── now playing (reference layout) ──────────────────────────────────────────
      '.mp-np{--mp-cover:min(31vw,48vh,520px);--mp-pane-gap:5vw;position:absolute;inset:0;z-index:70;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base,#141417);color:var(--dsw-alias-label-primary,#f4f4f5);transform:translateY(100%);visibility:hidden;transition:transform .32s ease,visibility .32s;pointer-events:none;user-select:none}',
      '.mp-np.is-open{transform:translateY(0);visibility:visible;pointer-events:auto}',
      '.mp-np-bg{position:absolute;inset:-40px;z-index:0;overflow:hidden}',
      '.mp-np-bg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:auto}.mp-np-bg .is-prev{opacity:1}.mp-np-bg .is-cur{animation:mp-bg-in .85s ease both}@keyframes mp-bg-in{from{opacity:0}to{opacity:1}}',
      '.mp-np-shade{position:absolute;inset:0;z-index:1;background:radial-gradient(85% 70% at 16% 6%,rgba(30,4,4,.22),transparent 62%),linear-gradient(180deg,rgba(14,2,2,.26),rgba(14,2,2,.06) 44%,rgba(14,2,2,.22) 80%,rgba(10,2,2,.44));pointer-events:none}',
      '.mp-np::after{content:"";position:absolute;inset:0;z-index:1;background:radial-gradient(52% 44% at 26% 22%,rgba(255,255,255,.05),transparent 70%),radial-gradient(44% 40% at 80% 82%,rgba(0,0,0,.28),transparent 74%);pointer-events:none}',
      '.mp-np-head{position:absolute;top:22px;left:22px;z-index:5;display:flex;align-items:center;gap:8px;padding:0}',
      '.mp-np-head .mp-iconbtn{width:36px;height:36px;border-radius:8px;color:rgba(255,255,255,.78)}',
      '.mp-np-head .mp-iconbtn:hover{background:rgba(255,255,255,.1);color:#fff}',
      '.mp-np-fs{position:absolute;top:22px;right:22px;z-index:6}',
      '.mp-np-fs .mp-iconbtn{width:36px;height:36px;border-radius:8px;color:rgba(255,255,255,.78)}',
      '.mp-np-fs .mp-iconbtn:hover{background:rgba(255,255,255,.1);color:#fff}',
      '.mp-np:fullscreen{width:100vw;height:100vh;transform:none;visibility:visible;background:var(--dsw-alias-bg-base,#141417)}',
      '.mp-np-head-title{display:none}',
      '.mp-np-head-actions{display:none}',
      '.mp-trans-toggle{width:auto;padding:0 8px;font-size:12px;font-weight:600;line-height:1}',
      '.mp-trans-toggle.is-on{color:var(--dsw-alias-brand-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1))}',
      '.mp-np-settings{position:absolute;bottom:84px;right:5vw;z-index:8;width:320px;max-width:calc(100% - 40px);max-height:calc(100% - 32px);overflow-y:auto;padding:14px;border:.5px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(24,24,28,.97);box-shadow:0 18px 48px rgba(0,0,0,.5)}',
      '.mp-np-setting{margin-bottom:14px}',
      '.mp-np-setting-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12px;color:rgba(255,255,255,.62)}.mp-np-setting select{width:100%;height:30px;padding:0 8px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.05);color:#f4f4f5;font:inherit;font-size:12px;outline:none;cursor:pointer}.mp-np-align-row{display:flex;gap:6px}.mp-np-align-row .mp-chip{flex:1;justify-content:center;min-width:0;height:28px;padding:0 4px}',
      '.mp-np-body{position:relative;z-index:2;flex:1;min-height:0;display:flex;align-items:stretch;padding:86px 2.5vw 0 6.5vw}',
      '.mp-np-left{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;flex:none;min-width:0;width:var(--mp-cover);padding-bottom:77px}',
      '.mp-np-meta{position:relative;min-width:0;margin:0 0 14px}',
      '.mp-np-meta-row{display:none}',
      '.mp-np-title{min-width:0;font-size:30px;font-weight:700;line-height:1.2;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-np-artist-row{display:flex;align-items:center;gap:10px;min-width:0;margin-top:10px}.mp-np-artist{flex:0 1 auto;min-width:0;font-size:15px;font-weight:400;color:rgba(255,255,255,.66);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-np-meta-audio{flex:none;color:rgba(255,255,255,.55);position:static}',
      '.mp-np-meta-audio:hover{color:#fff}',
      '.mp-np-cover-stage{position:relative;width:var(--mp-cover);margin:0 0 18px}',
      '.mp-np-disc-wrap{position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box}',
      '.mp-np-disc-wrap.is-vinyl{width:calc(var(--mp-cover) * .9);margin-left:auto;margin-right:auto;padding:calc(var(--mp-cover) * .06);top:30px}',
      '.mp-np-reflect-wave{position:absolute;left:0;top:50%;transform:translateY(-50%);transform-origin:50% 50%;transition:opacity .3s ease,transform .3s ease;width:100%;height:36px;pointer-events:none;z-index:0;mix-blend-mode:screen;opacity:.86;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 8%,#000 92%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 8%,#000 92%,transparent 100%)}.mp-np-reflect-wave.is-fading{opacity:0;transform:translateY(-50%) scaleY(.12)}',
      '.mp-np-cover-stage.is-vinyl .mp-np-reflect-wave{left:5%;width:90%}',
      '.mp-np-disc{position:relative;width:var(--mp-cover);height:var(--mp-cover);flex:none;aspect-ratio:1;display:flex;align-items:center;justify-content:center;animation:mp-disc-spin 24s linear infinite;animation-play-state:paused}',
      '.mp-np-disc.is-playing{animation-play-state:running}',
      '.mp-np-disc.is-square{animation:none}',
      '.mp-np-vinyl{position:absolute;inset:calc(var(--mp-cover) * -.06);aspect-ratio:1;border-radius:50%;clip-path:circle(50% at 50% 50%);background:repeating-radial-gradient(circle at 50% 50%,#141416 0 2px,#0b0b0d 2px 5px);box-shadow:inset 0 0 40px rgba(0,0,0,.85),0 18px 50px rgba(0,0,0,.5);z-index:0}',
      '.mp-np-art{position:relative;z-index:1;width:100%;height:100%;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141416;color:#71717a;box-shadow:0 26px 64px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06)}',
      '.mp-np-art::after{content:"";position:absolute;inset:0;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),inset 0 -40px 60px rgba(0,0,0,.16);pointer-events:none;z-index:2}',
      '.mp-np-art img{width:100%;height:100%;object-fit:cover;display:block;border-radius:8px}',
      '.mp-np-disc.is-circle .mp-np-art{border-radius:50%;clip-path:circle(50% at 50% 50%)}',
      '.mp-np-disc.is-circle .mp-np-art img{border-radius:50%}.mp-np-disc.is-vinyl{width:calc(var(--mp-cover) * .78);height:calc(var(--mp-cover) * .78)}',
      '.mp-np-quality{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:0 16px;min-height:20px;margin:auto 0 12px;font-size:13px;font-weight:500;color:rgba(255,255,255,.8);letter-spacing:.01em}',
      '.mp-np-quality-name{color:rgba(255,255,255,.95)}',
      '.mp-np-progress{position:relative;width:100%;margin:12px 0 0;padding:0;order:3}',
      '.mp-np-times{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:12px;order:4;font-size:13px;font-weight:500;color:rgba(255,255,255,.86);font-variant-numeric:tabular-nums}',
      '.mp-np-transport{display:flex;align-items:center;justify-content:center;gap:84px;margin:0;order:2}',
      '.mp-np-transport .mp-iconbtn{width:46px;height:46px;border-radius:50%;color:#fff}.mp-np-transport svg{stroke-width:2}.mp-np-secondary svg{stroke-width:1.9}',
      '.mp-np-transport .mp-iconbtn:hover{background:rgba(255,255,255,.08);color:#fff}',
      '.mp-np-transport .mp-pb-play{width:48px;height:48px;margin:0;border-radius:0;background:transparent;color:#fff;box-shadow:none}',
      '.mp-np-transport .mp-pb-play:hover{background:transparent;transform:none;box-shadow:none}',
      '.mp-np-transport .mp-pb-play:disabled{background:transparent;box-shadow:none}',
      '.mp-np-secondary{display:flex;align-items:center;justify-content:space-between;gap:0;width:100%;margin:12px 0 0;padding:0 2px;box-sizing:border-box;order:5}',
      '.mp-np-secondary .mp-iconbtn{width:40px;height:40px;border-radius:8px;color:rgba(255,255,255,.9)}',
      '.mp-np-secondary .mp-iconbtn:hover{background:rgba(255,255,255,.1);color:#fff}',
      '.mp-np-extra-item{position:relative;display:flex}',
      '.mp-np-extra-pop{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);z-index:10;width:210px;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(24,24,28,.96);box-shadow:0 16px 40px rgba(0,0,0,.5)}',
      '.mp-np-extra-option{display:block;width:100%;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;font:inherit;font-size:12px;cursor:pointer}',
      '.mp-np-extra-option:hover,.mp-np-extra-option.is-on{background:rgba(255,255,255,.08)}',
      '.mp-np-extra-option.is-on{color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-np-extra-pop.is-sleep{left:0;transform:none;width:280px;max-width:calc(100vw - 32px);padding:14px;border-radius:12px}',
      '.mp-np-sleep-head{display:flex;align-items:flex-start;gap:8px}',
      '.mp-np-sleep-head-icon{display:flex;flex:none;color:#f0b35b;margin-top:2px}',
      '.mp-np-sleep-title-wrap{flex:1;min-width:0}',
      '.mp-np-sleep-title{font-size:13px;font-weight:650;color:#f4f4f5}',
      '.mp-np-sleep-hint{margin-top:3px;font-size:11px;line-height:1.4;color:rgba(255,255,255,.55)}',
      '.mp-np-sleep-close{width:24px;height:24px;flex:none;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.5);cursor:pointer}',
      '.mp-np-sleep-close:hover{background:rgba(255,255,255,.08);color:#fff}',
      '.mp-np-sleep-label{margin-top:12px;font-size:11px;font-weight:600;letter-spacing:.04em;color:rgba(255,255,255,.5)}',
      '.mp-np-sleep-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}',
      '.mp-np-sleep-chip{height:30px;display:inline-flex;align-items:center;justify-content:center;gap:2px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.78);font:inherit;font-size:12px;cursor:pointer;transition:background .14s,border-color .14s,color .14s}',
      '.mp-np-sleep-chip span{font-size:10px;color:rgba(255,255,255,.45)}',
      '.mp-np-sleep-chip:hover{background:rgba(255,255,255,.08);color:#fff}',
      '.mp-np-sleep-chip.is-on{background:rgba(90,130,255,.18);border-color:rgba(120,160,255,.6);color:#fff}',
      '.mp-np-sleep-chip.is-on span{color:rgba(255,255,255,.7)}',
      '.mp-np-sleep-custom{display:flex;align-items:center;gap:6px;margin-top:6px}',
      '.mp-np-sleep-input{flex:1;min-width:0;height:30px;padding:0 8px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.04);color:#f4f4f5;font:inherit;font-size:12px;text-align:center;outline:none}',
      '.mp-np-sleep-input::placeholder{color:rgba(255,255,255,.35)}',
      '.mp-np-sleep-input:focus{border-color:rgba(120,160,255,.6)}',
      '.mp-np-sleep-unit{font-size:11px;color:rgba(255,255,255,.45)}',
      '.mp-np-sleep-set{height:30px;padding:0 10px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.08);color:#f4f4f5;font:inherit;font-size:12px;cursor:pointer}',
      '.mp-np-sleep-set:hover:not(:disabled){background:rgba(255,255,255,.14)}',
      '.mp-np-sleep-set:disabled{opacity:.4;cursor:not-allowed}',
      '.mp-np-sleep-error{margin-top:5px;font-size:10px;color:#ff9a9a}',
      '.mp-np-sleep-off{width:100%;height:30px;margin-top:12px;border:1px solid rgba(255,100,100,.22);border-radius:8px;background:rgba(255,80,80,.07);color:#ff9a9a;font:inherit;font-size:12px;cursor:pointer}',
      '.mp-np-sleep-off:hover{background:rgba(255,80,80,.14)}',
      '.mp-np-extra-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;font-size:12px}',
      '.mp-np-extra-hint{margin-top:10px;font-size:11px;color:rgba(255,255,255,.55)}',
      // ── audio effects: one panel, two views (volume / equalizer) ──────────
      // The now-playing surface is always dark (cover backdrop), so these follow
      // the neighbouring popover rules and use white alphas instead of --dsw-* text
      // tokens, which would resolve to dark ink in the light theme.
      // Fixed footprint: switching 音量 / 均衡器 or the equalizer tabs must not
      // resize the panel. Header stays put; each view scrolls inside its own body.
      '.mp-np-extra-pop.is-effects{display:flex;flex-direction:column;width:340px;max-width:calc(100vw - 24px);height:min(72vh,400px);max-height:min(72vh,400px);padding:12px;border-radius:12px;overflow:hidden}',
      '.mp-fx-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex:none}',
      '.mp-fx-title{font-size:12px;font-weight:650;color:#f4f4f5}',
      '.mp-fx-seg{display:flex;gap:2px;padding:2px;border-radius:8px;background:rgba(255,255,255,.06)}',
      '.mp-fx-seg-btn{padding:4px 10px;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.6);font:inherit;font-size:12px;cursor:pointer}',
      '.mp-fx-seg-btn:hover{color:#f4f4f5}',
      '.mp-fx-seg-btn.is-on{background:rgba(255,255,255,.14);color:#f4f4f5}',
      '.mp-fx-body{display:flex;flex:1;flex-direction:column;min-height:0;overflow-y:auto;overscroll-behavior:contain}',
      '.mp-fx-hint{margin-top:auto;padding-top:12px;font-size:11px;line-height:16px;color:rgba(255,255,255,.4)}',
      '.mp-fx-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:rgba(255,255,255,.75)}',
      '.mp-fx-value{font-size:11px;color:rgba(255,255,255,.55);font-variant-numeric:tabular-nums}',
      '.mp-fx-range{width:100%;margin-top:8px}',
      '.mp-eqp{display:flex;flex:1;flex-direction:column;min-height:0;gap:8px}',
      '.mp-eq-tabs-row{display:flex;align-items:center;gap:8px;flex:none}',
      '.mp-eq-tabs{display:flex;flex:1;min-width:0;gap:2px;padding:2px;border-radius:8px;background:rgba(255,255,255,.06)}',
      '.mp-eq-tab{flex:1;padding:5px 0;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.6);font:inherit;font-size:12px;cursor:pointer}',
      '.mp-eq-tab:hover{color:#f4f4f5}',
      '.mp-eq-tab.is-on{background:rgba(255,255,255,.13);color:#f4f4f5}',
      '.mp-eq-body{display:flex;flex:1;flex-direction:column;min-height:0;overflow-y:auto;overscroll-behavior:contain}',
      '.mp-eq-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;min-width:0}',
      '.mp-eq-preset{display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:0;padding:7px 8px;border:1px solid transparent;border-radius:8px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.85);font:inherit;text-align:left;cursor:pointer}',
      '.mp-eq-preset:hover{background:rgba(255,255,255,.1)}',
      '.mp-eq-preset.is-on{border-color:rgba(120,160,255,.65);background:rgba(90,130,255,.18);color:#fff}',
      '.mp-eq-preset-name{min-width:0;font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mp-eq-bars{display:flex;align-items:center;gap:2px;height:16px}',
      '.mp-eq-bars i{display:block;width:3px;min-height:2px;border-radius:1px;background:rgba(255,255,255,.42)}',
      '.mp-eq-preset.is-on .mp-eq-bars i,.mp-eq-saved-main:hover .mp-eq-bars i{background:rgba(150,180,255,.95)}',
      '.mp-eq-mine{display:flex;flex-direction:column;gap:8px}',
      // AutoEQ device browser: search stays fixed, only the result list scrolls.
      '.mp-eq-device{display:flex;flex:1;flex-direction:column;min-height:0;gap:8px}',
      '.mp-eq-search{flex:none;height:30px;padding:0 9px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.05);color:#f4f4f5;font:inherit;font-size:12px;outline:none}',
      '.mp-eq-search::placeholder{color:rgba(255,255,255,.35)}',
      '.mp-eq-search:focus{border-color:rgba(120,160,255,.6)}',
      '.mp-eq-device-scroll{display:flex;flex:1;flex-direction:column;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}',
      '.mp-eq-preset-caption{font-size:11px;line-height:14px;color:rgba(255,255,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mp-eq-preset.is-on .mp-eq-preset-caption{color:rgba(255,255,255,.7)}',
      '.mp-eq-more{flex:none;margin-top:6px;width:100%;padding:7px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.75);font:inherit;font-size:12px;cursor:pointer}',
      '.mp-eq-more:hover{background:rgba(255,255,255,.09);color:#fff}',
      '.mp-eq-device-count{flex:none;font-size:11px;line-height:14px;color:rgba(255,255,255,.4);text-align:center}',
      '.mp-eq-device-current{flex:none;font-size:11px;line-height:14px;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mp-eq-empty{display:flex;flex-direction:column;gap:4px;padding:20px 6px;text-align:center}',
      '.mp-eq-empty-title{font-size:12px;color:rgba(255,255,255,.8)}',
      '.mp-eq-empty-hint{font-size:11px;line-height:1.5;color:rgba(255,255,255,.45)}',
      '.mp-eq-saved{display:flex;flex-direction:column;gap:4px;max-height:214px;overflow-y:auto}',
      '.mp-eq-saved-row{display:flex;align-items:center;gap:2px}',
      '.mp-eq-saved-main{display:flex;flex:1;align-items:center;gap:8px;min-width:0;padding:6px 8px;border:0;border-radius:8px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.85);font:inherit;text-align:left;cursor:pointer}',
      '.mp-eq-saved-main:hover{background:rgba(255,255,255,.1);color:#fff}',
      '.mp-eq-saved-name{flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mp-eq-add{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;padding:8px;border:1px dashed rgba(255,255,255,.18);border-radius:8px;background:transparent;color:rgba(255,255,255,.6);font:inherit;font-size:12px;cursor:pointer}',
      '.mp-eq-add:hover{border-color:rgba(255,255,255,.32);color:#fff}',
      '.mp-eq-save-form{display:flex;align-items:center;gap:6px}',
      '.mp-eq-save-input{flex:1;min-width:0;height:30px;padding:0 8px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.05);color:#f4f4f5;font:inherit;font-size:12px;outline:none}',
      '.mp-eq-save-input:focus{border-color:rgba(120,160,255,.6)}',
      '.mp-eq-save-ok{flex:none;height:30px}',
      '.mp-eq-save-cancel{flex:none;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:rgba(255,255,255,.55);font:inherit;font-size:12px;cursor:pointer}',
      '.mp-eq-save-cancel:hover{color:#fff;background:rgba(255,255,255,.08)}',
      '.mp-eq-edit{display:flex;flex-direction:column;gap:8px}',
      '.mp-eq-curve{display:block;width:100%;height:64px;border-radius:8px;background:rgba(255,255,255,.04)}',
      '.mp-eq-curve-zero{stroke:rgba(255,255,255,.18);stroke-width:1;stroke-dasharray:3 3}',
      '.mp-eq-curve-line{fill:none;stroke:rgba(150,180,255,.95);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}',
      '.mp-eq-faders{display:flex;align-items:flex-start;justify-content:space-between;gap:1px;padding-top:2px}',
      '.mp-eq-fader{position:relative;display:flex;flex-direction:column;align-items:center;width:28px;height:118px}',
      '.mp-eq-fader-value{position:absolute;top:0;font-size:11px;line-height:14px;color:rgba(255,255,255,.55);font-variant-numeric:tabular-nums}',
      '.mp-eq-fader.is-active .mp-eq-fader-value{color:#fff}',
      '.mp-eq-fader input{position:absolute;top:54px;left:50%;width:88px;height:16px;margin:0;transform:translateX(-50%) rotate(-90deg);accent-color:rgba(150,180,255,.95)}',
      '.mp-eq-fader-label{position:absolute;bottom:0;font-size:11px;line-height:14px;color:rgba(255,255,255,.45)}',
      '.mp-eq-preamp{display:flex;align-items:center;gap:8px;font-size:11px;color:rgba(255,255,255,.55)}',
      '.mp-eq-preamp input{flex:1;min-width:0;width:auto}',
      '.mp-eq-preamp-value{flex:0 0 46px;text-align:right;font-variant-numeric:tabular-nums}',
      '.mp-eq-hint{font-size:11px;line-height:1.5;color:rgba(255,255,255,.4)}',
      '.mp-eq-actions{display:flex;gap:6px}',
      '.mp-eq-action{flex:1;padding:7px 8px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:transparent;color:rgba(255,255,255,.85);font:inherit;font-size:12px;cursor:pointer}',
      '.mp-eq-action:hover{background:rgba(255,255,255,.08);color:#fff}',
      '.mp-eq-warn{font-size:11px;line-height:1.5;color:#e6b061}',
      '.mp-eqp :focus-visible{outline:2px solid var(--dsw-focus-ring-color,#7AAAFF);outline-offset:2px}',
      '.mp-np .mp-seek{height:16px}',
      '.mp-np .mp-seek::before{height:2px;background:rgba(255,255,255,.24)}',
      '.mp-np .mp-seek-buffer{height:2px;background:rgba(255,255,255,.34)}',
      '.mp-np .mp-seek::after{height:2px;background:#fff}',
      '.mp-np .mp-seek:hover::before,.mp-np .mp-seek:hover::after,.mp-np .mp-seek:hover .mp-seek-buffer{height:3px}',
      '.mp-np .mp-seek input{height:16px}',
      '.mp-np .mp-seek input::-webkit-slider-runnable-track{height:16px}',
      '.mp-np .mp-seek input::-webkit-slider-thumb{width:10px;height:10px;margin-top:3px;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.16);opacity:1}',
      '.mp-np .mp-seek:hover input::-webkit-slider-thumb{width:12px;height:12px;margin-top:2px}',
      '.mp-np .mp-seek input::-moz-range-track{height:16px}',
      '.mp-np .mp-seek input::-moz-range-thumb{width:10px;height:10px;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.16);opacity:1}',
      '.mp-align-left .mp-np-line{text-align:left}',
      '.mp-align-center .mp-np-line{text-align:center}',
      '.mp-align-right .mp-np-line{text-align:right}',
      '.mp-np-right{position:relative;flex:1 1 auto;width:auto;min-width:0;min-height:0;margin-left:var(--mp-pane-gap,5vw);display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;padding-bottom:77px}',
      '.mp-np-lyrics{position:relative;flex:1;width:100%;min-height:0;height:auto;max-width:none;max-height:none;padding-top:78px;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 10%,#000 88%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 10%,#000 88%,transparent 100%)}',
      '.mp-np-lyrics.is-static{overflow-y:auto;-webkit-mask-image:none;mask-image:none}',
      '.mp-np-lyrics.is-static .mp-np-line{opacity:.75;cursor:default}',
      '.mp-np-lyrics-inner{padding:0;will-change:transform;backface-visibility:hidden}',
      '.mp-np-lyrics-empty{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;color:rgba(255,255,255,.9);text-align:center;pointer-events:none}',
      '.mp-np-lyrics-empty-icon{width:72px;height:72px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.12);color:rgba(255,255,255,.88);box-shadow:0 8px 24px rgba(0,0,0,.14)}',
      '.mp-np-lyrics-empty-icon svg{width:34px;height:34px}',
      '.mp-np-lyrics-empty-text{font-size:14px;font-weight:500;line-height:1.6;color:rgba(255,255,255,.88);text-shadow:0 1px 8px rgba(0,0,0,.3)}',
      '.mp-np-line{padding:var(--mp-line-gap,6px) 0;border-radius:0;color:rgba(255,255,255,.6);cursor:pointer;transition:color .25s ease,opacity .3s ease,filter .25s ease;text-align:left;opacity:1;transform:none}',
      '.mp-np-line:hover{color:rgba(255,255,255,.86)}',
      '.mp-np-line.is-past{opacity:.46}',
      '.mp-np-line.is-active{color:#fff;opacity:1}',
      '.mp-np-line.is-focus{opacity:1;filter:none}',
      '.mp-np-line.is-focus:not(.is-active){color:rgba(255,255,255,.88)}',
      '.mp-np-line-text{font-size:var(--mp-lyric-size,26px);line-height:1.2;font-weight:600;white-space:normal;word-break:break-word;overflow-wrap:anywhere;letter-spacing:.005em}',
      '.mp-np-line-time{display:inline-block;margin-left:8px;font-size:11px;line-height:1;font-weight:500;letter-spacing:.02em;color:rgba(255,255,255,.42);vertical-align:middle;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.mp-np-line.is-active .mp-np-line-text{text-shadow:0 2px 22px rgba(0,0,0,.35)}',
      '.mp-np-line-trans{display:grid;grid-template-rows:0fr;margin-top:0;opacity:0;font-size:var(--mp-lyric-trans,16px);line-height:1.2;font-weight:400;color:rgba(255,255,255,.58);transition:grid-template-rows .26s cubic-bezier(.22,.61,.36,1) .14s,opacity .14s ease 0s,margin-top .26s cubic-bezier(.22,.61,.36,1) .14s}.mp-np-line-trans-inner{display:block;min-height:0;overflow:hidden}.mp-np.is-trans .mp-np-line-trans-inner{min-height:calc(var(--mp-trans,1) * var(--mp-lyric-trans,16px) * 1.2)}.mp-np-line-trans-text{display:block}.mp-np.is-trans .mp-np-line-trans{grid-template-rows:1fr;margin-top:calc(var(--mp-trans,1) * 2px);opacity:1;transition:grid-template-rows .26s cubic-bezier(.22,.61,.36,1) 0s,opacity .2s ease .1s,margin-top .26s cubic-bezier(.22,.61,.36,1) 0s}',
      '.mp-np-line.is-active .mp-np-line-trans{color:rgba(255,255,255,.82)}',
      '.mp-np.is-blur .mp-np-line:not(.is-focus){opacity:.44;filter:blur(calc(0.2px + var(--mp-line-stagger,0) * 0.22px))}',
      '.mp-np-lyric-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;flex:none;margin-top:14px;min-height:30px}',
      '.mp-np-lyric-tag{display:flex;align-items:center;gap:8px;font-size:12px;color:rgba(255,255,255,.7)}',
      '.mp-np-lyric-tag-badge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 4px;border:1px solid rgba(255,255,255,.42);border-radius:5px;background:transparent;font:inherit;font-size:12px;font-weight:500;line-height:1;color:rgba(255,255,255,.92);cursor:pointer}.mp-np-lyric-tag-badge:hover,.mp-np-lyric-tag-badge.is-on{border-color:rgba(255,255,255,.72);background:rgba(255,255,255,.1);color:#fff}',
      '.mp-np-lyric-source{font-size:12px;letter-spacing:.06em;color:rgba(255,255,255,.8)}',
      '.mp-np-foot-right{display:flex;align-items:center;gap:10px;margin-left:auto}',
      '.mp-np-foot-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;min-width:30px;padding:0 7px;border:1px solid transparent;border-radius:8px;background:transparent;color:rgba(255,255,255,.78);font:inherit;font-size:13px;font-weight:600;cursor:pointer}',
      '.mp-np-foot-btn.is-boxed{border-color:rgba(255,255,255,.45)}',
      '.mp-npe{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:24px;overflow:hidden;background:rgba(0,0,0,.62);animation:mp-npe-fade .18s ease}',
      '.mp-npe-panel{position:relative;width:min(440px,100%);min-width:0;box-sizing:border-box;height:auto;max-height:min(760px,100%);display:flex;flex-direction:column;background:#151519;border:1px solid rgba(255,255,255,.12);border-radius:16px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.6);animation:mp-npe-pop .22s cubic-bezier(.22,.61,.36,1)}',
      '.mp-npe-head{display:flex;align-items:flex-start;gap:12px;padding:22px 22px 16px;border-bottom:1px solid rgba(255,255,255,.08);flex:none}',
      '.mp-npe-head-text{flex:1;min-width:0}',
      '.mp-npe-title{font-size:18px;font-weight:700;line-height:1.25}',
      '.mp-npe-sub{margin-top:3px;font-size:12px;color:rgba(255,255,255,.55)}',
      '.mp-npe-close{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);cursor:pointer;transition:background .14s,color .14s}',
      '.mp-npe-close:hover{background:rgba(255,255,255,.12);color:#fff}',
      '.mp-npe-head-actions{display:flex;align-items:center;gap:6px;flex:none}',
      '.mp-npe-head-btn{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);cursor:pointer;transition:background .14s,color .14s}',
      '.mp-npe-head-btn:hover{background:rgba(255,255,255,.12);color:#fff}',
      '.mp-npe-confirm{display:flex;align-items:center;gap:10px;padding:10px 22px;background:rgba(240,179,91,.08);border-bottom:1px solid rgba(240,179,91,.22)}',
      '.mp-npe-confirm-text{flex:1;min-width:0}',
      '.mp-npe-confirm-title{font-size:12px;font-weight:600;color:#ffd9a0}',
      '.mp-npe-confirm-hint{margin-top:2px;font-size:10px;line-height:1.4;color:rgba(255,255,255,.5)}',
      '.mp-npe-confirm-btn{height:26px;padding:0 9px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.8);font:inherit;font-size:11px;cursor:pointer}',
      '.mp-npe-confirm-btn:hover{background:rgba(255,255,255,.12)}',
      '.mp-npe-confirm-btn.is-primary{background:#e6a85a;border-color:#e6a85a;color:#241708}',
      '.mp-npe-confirm-btn.is-primary:hover{background:#f0b86a;border-color:#f0b86a}',
      '.mp-npe-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:18px 22px 22px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
      '.mp-npe-section{margin-bottom:24px}',
      '.mp-npe-sec-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}',
      '.mp-npe-sec-title{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);white-space:nowrap}',
      '.mp-npe-sec-line{flex:1;height:1px;background:rgba(255,255,255,.08)}',
      '.mp-npe-cover-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;min-width:0}',
      '.mp-npe-cover-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 10px 10px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.035);color:rgba(255,255,255,.72);cursor:pointer;transition:border-color .16s,background .16s,box-shadow .16s,color .16s}',
      '.mp-npe-cover-card:hover{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.06)}',
      '.mp-npe-cover-card.is-on{border-color:rgba(120,160,255,.75);background:rgba(90,130,255,.14);box-shadow:0 0 0 1px rgba(120,160,255,.35),0 8px 24px rgba(40,80,200,.18);color:#fff}',
      '.mp-npe-cover-preview{width:78px;height:78px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:rgba(255,255,255,.35)}',
      '.mp-npe-cover-preview img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mp-npe-cover-square{border-radius:8px;background:#0c0c0e;box-shadow:0 6px 18px rgba(0,0,0,.35)}',
      '.mp-npe-cover-vinyl{border-radius:50%;background:repeating-radial-gradient(circle at 50% 50%,#141416 0 2px,#0b0b0d 2px 5px);box-shadow:0 8px 20px rgba(0,0,0,.4)}',
      '.mp-npe-cover-vinyl img{width:74%;height:74%;border-radius:50%}',
      '.mp-npe-cover-label{font-size:12px;font-weight:500}',
      '.mp-npe-cover-check{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:#5b8cff;color:#fff;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.3)}',
      '.mp-npe-row{margin-top:14px}',
      '.mp-npe-range-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12px;color:rgba(255,255,255,.72)}',
      '.mp-npe-val{color:rgba(255,255,255,.55);font-variant-numeric:tabular-nums}',
      '.mp-npe-seg{display:flex;gap:6px}',
      '.mp-npe-seg-btn{flex:1;height:30px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);font:inherit;font-size:12px;cursor:pointer;transition:background .14s,border-color .14s,color .14s}',
      '.mp-npe-seg-btn:hover{background:rgba(255,255,255,.08);color:#fff}',
      '.mp-npe-seg-btn.is-on{background:rgba(90,130,255,.18);border-color:rgba(120,160,255,.6);color:#fff}',
      '.mp-npe-switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;color:rgba(255,255,255,.82)}.mp-npe-switch-row>span{min-width:0;overflow-wrap:anywhere}',
      '.mp-npe-body select{width:100%;height:32px;margin-top:4px;padding:0 9px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.05);color:#f4f4f5;font:inherit;font-size:12px;outline:none;cursor:pointer}',
      '.mp-npe-foot{display:flex;gap:10px;padding:14px 22px;border-top:1px solid rgba(255,255,255,.08);background:rgba(18,18,22,.72);flex:none}',
      '.mp-npe-btn{flex:1;height:36px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.05);color:#f4f4f5;font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .14s,border-color .14s}',
      '.mp-npe-btn:hover{background:rgba(255,255,255,.1)}',
      '.mp-npe-btn.is-primary{background:#5b8cff;border-color:#5b8cff;color:#fff}',
      '.mp-npe-btn.is-primary:hover{background:#6f9aff;border-color:#6f9aff}',
      '@keyframes mp-npe-fade{from{opacity:0}to{opacity:1}}',
      '@keyframes mp-npe-pop{from{transform:translateY(12px) scale(.985);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}',
      '@media (min-width:981px){.mp-np-disc-wrap{-webkit-box-reflect:below 4px linear-gradient(to top,rgba(0,0,0,.45),rgba(0,0,0,0) 96px)}}',
      '@media (min-width:981px) and (max-height:860px){.mp-np-disc-wrap{-webkit-box-reflect:below 2px linear-gradient(to top,rgba(0,0,0,.38),rgba(0,0,0,0) 26px)}}',
      '@media (max-width:620px){.mp-npe{padding:8px}.mp-npe-panel{width:100%;max-height:100%}.mp-npe-head{padding:18px 18px 14px}.mp-npe-body{padding:14px 18px 18px}.mp-npe-foot{padding:12px 18px}}',
      '@media (prefers-reduced-motion:reduce){.mp-npe,.mp-npe-panel{animation:none}}',
      '.mp-np-foot-btn:hover,.mp-np-foot-btn.is-on{background:rgba(255,255,255,.1);color:#fff}',
      '.mp-quality{font-size:11px;color:var(--dsw-alias-label-tertiary,#a1a1aa);font-variant-numeric:tabular-nums;white-space:nowrap;padding:2px 6px;border-radius:8px;background:rgba(255,255,255,.06)}',
      '@keyframes mp-disc-spin{to{transform:rotate(360deg)}}',

      // ── overlays, sheet, dialogs, menu, toast ───────────────────────────────
      '.mp-overlay{position:absolute;inset:0;z-index:85;display:flex;align-items:center;justify-content:center;pointer-events:none}',
      '.mp-overlay.is-on{pointer-events:auto}',
      '.mp-scrim{position:absolute;inset:0;background:rgba(0,0,0,.45)}',


      '.mp-set-status{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:-4px 0 8px 12px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-set-status i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#8a8a93);flex:none}',
      '.mp-set-status.is-on{color:var(--dsw-alias-state-success-primary,#2f9e44)}',
      '.mp-set-status.is-on i{background:var(--dsw-alias-state-success-primary,#2f9e44)}',
      '.mp-set-status.is-bad{color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mp-set-status.is-bad i{background:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mp-set-status.is-off{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-set-status-hint{color:var(--dsw-alias-label-tertiary,#8a8a93)}',


      '.mp-online-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}',
      '.mp-online-head h2{margin:0}',
      '.mp-online-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));padding:3px 8px;border-radius:999px;font-variant-numeric:tabular-nums}',
      '.mp-online-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '.mp-online-card{--mp-brand:#4176E6;position:relative;overflow:hidden;padding:13px;border-radius:16px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));background:var(--dsw-alias-bg-layer-2,#1e1e22);min-width:0}',
      '.mp-online-card:before{content:"";position:absolute;left:0;top:18px;bottom:18px;width:3px;border-radius:0 8px 8px 0;background:var(--mp-brand)}',
      '.mp-online-card.is-netease{--mp-brand:#e60026}',
      '.mp-online-card.is-qq{--mp-brand:#31c27c}',
      '.mp-online-card.is-kugou{--mp-brand:#2b7cff}',
      '.mp-online-card.is-kugouLite{--mp-brand:#6aa8ff}',
      '.mp-online-card.is-navidrome{--mp-brand:#00b3a4}',
      '.mp-navidrome-body{display:flex;flex-direction:column;gap:8px}',
      '.mp-navidrome-body .mp-kit-input{flex:0 0 auto;width:100%}',
      '.mp-online-error{color:var(--dsw-alias-state-error-text,#f87171);font-size:12px;line-height:1.4}',
      '.mp-online-ok{color:var(--dsw-alias-state-success-text,#4ade80);font-size:12px;line-height:1.4}',
      '.mp-navidrome-form{display:flex;flex-direction:column;gap:6px;min-width:min(380px,70vw)}',
      '.mp-navidrome-footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;width:100%;min-width:0}',
      '.mp-navidrome-footer .mp-btn{flex:none;min-width:76px;justify-content:center}',
      '.mp-navidrome-form .mp-kit-input{flex:0 0 auto;width:100%;height:32px}',
      '.mp-navidrome-label{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-top:4px}',
      '.mp-navidrome-hint{margin:4px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#71717a)}',
      '.mp-navidrome-check{display:flex;align-items:flex-start;gap:7px;margin-top:6px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer}',
      '.mp-navidrome-check input{margin:2px 0 0;flex:0 0 auto}',
      '.mp-navidrome-warn{margin:2px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-warning-text,#fbbf24)}',
      '.mp-loaded-of{font-size:12px;color:var(--dsw-alias-label-tertiary,#71717a)}',
      '.mp-songs-pane{flex:1;min-height:0;display:flex;flex-direction:column}',
      '.mp-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px;padding:4px 0 12px}',
      '.mp-card{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid transparent;border-radius:12px;background:transparent;text-align:left;cursor:pointer;min-width:0}',
      '.mp-card:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));border-color:var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-card-art{position:relative;width:100%;aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.05));display:flex;align-items:center;justify-content:center}',
      '.mp-card.is-round .mp-card-art{border-radius:50%}',
      // Cover renders a bare <img> with no intrinsic sizing, so every container has
      // to clamp it the way `.mp-srow-cover img` does; without this the artwork
      // paints at its natural size and blows the card open.
      '.mp-card-art img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mp-card-art-fallback{color:var(--dsw-alias-label-tertiary,#71717a)}',
      '.mp-card-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-card-sub{font-size:12px;color:var(--dsw-alias-label-tertiary,#71717a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-pager{display:flex;align-items:center;justify-content:center;gap:10px;flex:0 0 auto;padding:8px 12px 14px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))}',
      '.mp-pager.is-hint{justify-content:space-between;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03))}',
      '.mp-loaded-end{font-size:12px;color:var(--dsw-alias-state-success-text,#4ade80)}',
      '.mp-page-num{min-width:28px;height:26px;padding:0 7px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;cursor:pointer;font-variant-numeric:tabular-nums}',
      '.mp-page-num:hover:not(:disabled){color:var(--dsw-alias-label-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}',
      '.mp-page-num.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600;border-color:transparent}',
      '.mp-page-num:disabled{opacity:.45;cursor:default}',
      '.mp-page-gap{padding:0 2px;font-size:12px;color:var(--dsw-alias-label-tertiary,#71717a)}',
      '.mp-online-card.is-logged{background:linear-gradient(135deg,color-mix(in srgb,var(--mp-brand) 7%,var(--dsw-alias-bg-layer-2,#1e1e22)),var(--dsw-alias-bg-layer-2,#1e1e22) 72%)}',
      '.mp-online-card-head{display:flex;align-items:center;gap:10px;min-width:0}',
      '.mp-online-logo{width:38px;height:38px;border-radius:12px;overflow:hidden;flex:none;box-shadow:0 4px 14px rgba(0,0,0,.16)}',
      '.mp-online-logo img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mp-online-title{min-width:0;flex:1}',
      '.mp-online-name{font-size:13.5px;font-weight:650;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-online-state{font-size:10px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px}',
      '.mp-online-card.is-logged .mp-online-state{color:var(--mp-brand)}',
      '.mp-online-body{display:flex;align-items:center;gap:9px;margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));min-width:0}',
      '.mp-online-card .mp-account-avatar{width:34px;height:34px}',
      '.mp-online-meta{min-width:0;flex:1;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.mp-online-nick{font-size:11px;font-weight:550;color:var(--dsw-alias-label-secondary,#b4b4bd);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}',
      '.mp-online-id{font-size:10px;color:var(--dsw-alias-label-tertiary,#8a8a93);white-space:nowrap}',
      '.mp-online-vip{font-size:9px;font-weight:700;line-height:1;padding:2px 5px;border-radius:8px;color:#8a5a00;background:#ffd76a;flex:none}',
      '.mp-online-body.is-out{justify-content:space-between;gap:8px;border-top:0;padding-top:0;margin-top:10px}',
      '.mp-online-hint-text{font-size:10px;line-height:1.35;color:var(--dsw-alias-label-tertiary,#8a8a93);min-width:0}',
      '.mp-online-foot{display:flex;align-items:flex-start;gap:7px;margin-top:14px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03));border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-online-foot svg{flex:none;margin-top:1px}',
      '.mp-provider-name{display:flex;align-items:center;gap:8px}',
      '.mp-provider-icon{display:inline-flex;width:20px;height:20px;flex:none}',
      '.mp-provider-logo{width:100%;height:100%;object-fit:contain;border-radius:8px;display:block}',
      '.mp-account{display:flex;align-items:center;gap:8px}',
      '.mp-login-modes{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
      '.mp-account-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08));flex:none}',
      '.mp-account-avatar.is-fallback{display:grid;place-items:center;font-size:12px;font-weight:650;color:var(--dsw-alias-label-secondary,#b4b4bd)}',
      '.mp-cache-block{margin-top:16px;display:flex;flex-direction:column;gap:8px}',
      '.mp-cache-heading{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary,#b4b4bd)}',
      '.mp-cache-heading span{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-cache-list{max-height:340px;overflow-y:auto;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:12px;background:var(--dsw-alias-bg-layer-2,#1e1e22)}',
      '.mp-cache-row{display:flex;align-items:center;gap:10px;padding:8px 10px;min-width:0}',
      '.mp-cache-row + .mp-cache-row{border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-cache-provider{display:inline-flex;width:18px;height:18px;flex:none}',
      '.mp-cache-main{min-width:0;flex:1}',
      '.mp-cache-title{font-size:12px;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-cache-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}',
      '.mp-cache-time,.mp-cache-size{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums;flex:none}',
      '.mp-cache-size{min-width:52px;text-align:right}',
      '.mp-cache-tag{font-size:9px;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-tertiary,#8a8a93);flex:none}',
      '.mp-cache-empty{padding:18px 12px;text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);border:1px dashed var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:12px}',

      '.mp-set-page-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:4px}',
      '.mp-set-page-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);white-space:nowrap}',
      '.mp-set-card{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:16px;background:var(--dsw-alias-bg-layer-2,#1e1e22);margin-top:12px;overflow:hidden}',
      '.mp-set-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-set-card-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:650;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-set-card-body{padding:2px 12px}',
      '.mp-set-card-body .mp-set-row:last-child{border-bottom:0}',
      '.mp-root-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-set-card-body > .mp-root-row:first-child{border-top:0}',
      '.mp-root-row.is-hidden .mp-root-path{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-root-icon{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none;color:var(--dsw-alias-state-business-primary,#7AAAFF);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-root-main{min-width:0;flex:1}',
      '.mp-root-path{font-size:12px;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-root-state{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px}',
      '.mp-root-actions{display:flex;align-items:center;gap:6px;flex:none}',
      '.mp-root-add{display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));background:var(--dsw-alias-bg-layer-1,#15151a)}',
      '.mp-root-add .mp-kit-input{flex:1;min-width:0}',
      '.mp-set-empty-card{padding:18px 0;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-set-hint-line{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);padding:0 0 10px}',
      '.mp-about-card{display:flex;align-items:center;gap:14px;padding:16px;border-radius:16px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));background:var(--dsw-alias-bg-layer-2,#1e1e22)}',
      '.mp-about-logo{width:64px;height:64px;flex:none;border-radius:50%;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,.28)}',
      '.mp-about-main{min-width:0}',
      '.mp-about-name{font-size:15px;font-weight:700;letter-spacing:.01em}',
      '.mp-about-version{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px;font-variant-numeric:tabular-nums}',
      '.mp-about-tagline{font-size:12px;color:var(--dsw-alias-label-secondary,#b4b4bd);margin-top:6px}',
      '.mp-about-rows{display:flex;flex-direction:column;gap:0;margin-top:14px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:12px;overflow:hidden}',
      '.mp-about-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#b4b4bd)}',
      '.mp-about-row + .mp-about-row{border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-about-row strong{font-weight:550;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-about-row a,.mp-about-links a{color:var(--dsw-alias-state-business-primary,#7AAAFF);text-decoration:none}',
      '.mp-about-row a:hover,.mp-about-links a:hover{text-decoration:underline}',
      '.mp-about-links{display:flex;gap:16px;margin-top:14px;font-size:12px}',

      '.mp-sheet-close{position:absolute;top:10px;right:10px;z-index:3;width:28px;height:28px;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;transition:background .14s,color .14s}',
      '.mp-sheet-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#f4f4f5);border-color:var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-sheet{position:relative;width:min(760px,calc(100vw - 48px));height:min(560px,calc(100vh - 96px));display:grid;grid-template-columns:180px minmax(0,1fr);background:var(--dsw-alias-bg-layer-1,#1a1a1e);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:16px;overflow:hidden;box-shadow:var(--dsw-elevation-panel,0 30px 80px rgba(0,0,0,.5))}',
      '.mp-sheet-nav{display:flex;flex-direction:column;gap:2px;padding:16px 10px;background:var(--dsw-alias-bg-layer-1,#15151a);border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-sheet-title{padding:0 10px 10px;font-size:13px;font-weight:650}',
      '.mp-sheet-tab{height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;text-align:left;cursor:pointer}',
      '.mp-sheet-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-sheet-tab.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600}',
      '.mp-sheet-body{overflow-y:auto;padding:18px 52px 26px 22px}',
      '.mp-sheet-body h2{margin:0 0 14px;font-size:14px;font-weight:650}',
      '.mp-set-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;padding:11px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-set-choice-row{display:flex;flex-wrap:wrap;gap:4px}',
      '.mp-set-text{min-width:0;flex:1 1 220px}',
      '.mp-set-label{font-size:13px}',
      '.mp-set-desc{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px}',
      '.mp-set-control{flex:0 1 auto;max-width:100%;display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-left:auto}',
      '.mp-set-control select{height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font-size:12px}',
      '.mp-range{width:120px;accent-color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-set-val{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);width:44px;text-align:right;font-variant-numeric:tabular-nums}',
      '.mp-switch{position:relative;width:38px;height:22px;border-radius:999px;border:0;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12));cursor:pointer;transition:background .15s;flex:none}',
      '.mp-switch i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}',
      '.mp-switch.is-on{background:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-switch.is-on i{transform:translateX(16px)}',
      '.mp-dialog{position:relative;width:min(640px,100%);max-height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#1a1a1e);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:16px;overflow:hidden;box-shadow:var(--dsw-elevation-panel,0 30px 80px rgba(0,0,0,.5))}',
      '.mp-dialog.is-sm{width:min(380px,100%)}',
      '.mp-d-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-d-title{font-size:13.5px;font-weight:650}',
      '.mp-d-head .mp-spacer{margin-left:auto}',
      '.mp-d-body{padding:16px 18px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:12px}',
      '.mp-d-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-field{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.mp-field label{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-d-body > *{flex-shrink:0}',
      '.mp-field input,.mp-field textarea{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font:inherit;font-size:13px;outline:none}',
      '.mp-field input:focus,.mp-field textarea:focus{border-color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-field textarea{resize:vertical;min-height:96px;font-size:12px;line-height:1.6}',
      '.mp-d-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',

      '.mp-login-card{width:100%;max-width:320px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:10px;padding:2px 0 4px}',
      '.mp-login-head{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;text-align:center}',
      '.mp-login-logo{width:38px;height:38px;border-radius:8px;overflow:hidden;flex:none;box-shadow:0 4px 14px rgba(0,0,0,.18)}',
      '.mp-login-logo img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mp-login-headtext{min-width:0;max-width:100%;text-align:center}',
      '.mp-login-title{font-size:16px;font-weight:650;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-login-sub{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mp-login-qr-shell{position:relative;padding:9px;border-radius:16px;background:linear-gradient(145deg,var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08)),var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03)));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));box-shadow:0 12px 34px rgba(0,0,0,.18)}',
      '.mp-login-qr-frame{position:relative;width:190px;height:190px;padding:7px;border-radius:12px;background:#fff;display:grid;place-items:center;overflow:hidden}',
      '.mp-login-qr-img{width:100%;height:100%;object-fit:contain;border-radius:8px;display:block}',
      '.mp-login-qr-loading{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:11px;color:#8a8a93}',
      '.mp-login-spinner{width:18px;height:18px;border:2px solid rgba(0,0,0,.12);border-top-color:#4176E6;border-radius:50%;animation:mp-login-spin .8s linear infinite}',
      '.mp-login-corner{position:absolute;width:16px;height:16px;border-color:var(--dsw-alias-state-business-primary,#4176E6);border-style:solid;pointer-events:none}',
      '.mp-login-corner.tl{left:2px;top:2px;border-width:2px 0 0 2px;border-radius:8px 0 0 0}',
      '.mp-login-corner.tr{right:2px;top:2px;border-width:2px 2px 0 0;border-radius:0 8px 0 0}',
      '.mp-login-corner.bl{left:2px;bottom:2px;border-width:0 0 2px 2px;border-radius:0 0 0 8px}',
      '.mp-login-corner.br{right:2px;bottom:2px;border-width:0 2px 2px 0;border-radius:0 0 8px 0}',
      '.mp-login-qr-frame.is-scanned{box-shadow:inset 0 0 0 2px var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-login-status{display:flex;align-items:center;justify-content:center;gap:7px;width:auto;max-width:100%;min-height:26px;margin:0 auto;padding:6px 14px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;text-align:center}',
      '.mp-login-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4176E6);flex:none;animation:mp-login-pulse 1.6s ease-in-out infinite}',
      '.mp-login-status.is-scanned{color:var(--dsw-alias-state-business-primary,#4176E6);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-login-status.is-success{color:var(--dsw-alias-state-success-primary,#2f9e44)}',
      '.mp-login-status.is-success .mp-login-dot{background:var(--dsw-alias-state-success-primary,#2f9e44);animation:none}',
      '.mp-login-status.is-error{color:var(--dsw-alias-state-error-primary,#e5484d);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 10%,transparent)}',
      '.mp-login-status.is-error .mp-login-dot{background:var(--dsw-alias-state-error-primary,#e5484d);animation:none}',
      '.mp-login-steps{display:flex;flex-direction:column;gap:5px;width:100%;max-width:240px;margin:0 auto;padding:0}',
      '.mp-login-step{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-login-step b{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-secondary,#b4b4bd);font-size:11px;font-weight:650;flex:none}',
      '.mp-login-secure{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);opacity:.9}',
      '.mp-login-actions{display:flex;align-items:center;gap:8px;width:100%;justify-content:center;padding-top:2px}',
      '@keyframes mp-login-pulse{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}',
      '@keyframes mp-login-spin{to{transform:rotate(360deg)}}',
      '@media (prefers-reduced-motion:reduce){.mp-login-dot,.mp-login-spinner{animation:none}}',
      '.mp-qr{width:190px;height:190px;margin:4px auto;border-radius:12px;background:#fff;display:grid;place-items:center;overflow:hidden}',
      '.mp-qr img{width:100%;height:100%;object-fit:contain}',
      '.mp-qr-hint{text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-ctx{position:fixed;z-index:80;min-width:186px;padding:4px;border-radius:12px;background:var(--dsw-menu-surface-fill,rgba(26,26,30,.72));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px) saturate(1.3));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px) saturate(1.3));box-shadow:var(--dsw-elevation-panel,0 16px 44px rgba(0,0,0,.5));display:flex;flex-direction:column}',
      '.mp-ctx button{display:flex;align-items:center;gap:9px;height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font-size:13px;text-align:left;cursor:pointer}',
      '.mp-ctx button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-ctx hr{border:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));margin:4px 2px}',
      '.mp-toast{position:absolute;left:50%;bottom:100px;transform:translateX(-50%) translateY(6px);z-index:90;padding:8px 14px;border-radius:12px;background:var(--dsw-alias-toast-bg,#2c2c2e);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));color:var(--dsw-alias-toast-label,#fff);font-size:12px;box-shadow:var(--dsw-elevation-panel,0 12px 32px rgba(0,0,0,.45));opacity:0;transition:.18s;pointer-events:none;max-width:70%}',
      '.mp-toast.is-on{opacity:1;transform:translateX(-50%)}',

      // ── selection / batch / match / lyric search ───────────────────────────
      '.mp-row-check{position:static;width:20px;height:20px;margin-right:6px;padding:0;font:inherit;cursor:pointer;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:transparent;display:grid;place-items:center;color:#fff;opacity:0;transition:opacity .12s}',
      '.mp-row:hover .mp-row-check,.mp-row.is-selected .mp-row-check,.mp-row-check:focus-visible{opacity:1}',
      '.mp-row-check.is-on{background:var(--dsw-alias-button-primary-fill,#f4f4f5);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#141417)}',
      '.mp-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-tag-footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;width:100%;min-width:0}',
      '.mp-tag-footer .mp-btn{flex:none;min-width:76px;justify-content:center}',
      '.mp-tag-body{gap:14px;max-height:min(66vh,720px);overflow-y:auto;padding-right:6px;scrollbar-width:thin;overscroll-behavior:contain;flex:1 1 auto;min-height:0}',
      '.mp-tag-body>*{flex:none}',
      '.mp-tag-layout{display:grid;grid-template-columns:172px minmax(0,1fr);gap:16px;align-items:start;min-width:0}',
      '.mp-tag-aside{position:sticky;top:0;display:flex;flex-direction:column;gap:10px;min-width:0;padding:12px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.035))}',
      '.mp-tag-aside .mp-tag-cover{width:112px;height:112px}',
      '.mp-tag-aside-title{font-size:16px;line-height:22px;font-weight:650;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-tag-aside-artist{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-tag-aside-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-tag-aside-actions{display:flex;flex-direction:column;gap:6px}',
      '.mp-tag-aside-actions .mp-btn{width:100%;justify-content:center}',
      '.mp-tag-form{display:flex;flex-direction:column;gap:12px;min-width:0}',
      '.mp-tag-hero{display:flex;gap:14px;align-items:center;min-width:0;padding:12px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.035));flex:none}',
      '.mp-tag-cover-row{display:flex;gap:12px;align-items:center}',
      '.mp-tag-cover{width:88px;height:88px;border-radius:12px;flex:none;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));display:grid;place-items:center;overflow:hidden;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-tag-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-tag-hero-main{min-width:0;flex:1}',
      '.mp-tag-hero-title{font-size:16px;line-height:22px;font-weight:650;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-tag-hero-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-tag-hero-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:9px}',
      '.mp-tag-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:8px}',
      '.mp-tag-section{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.02));flex:none}',
      '.mp-tag-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.035))}',
      '.mp-tag-section-title{margin:0;font-size:11px;line-height:16px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mp-tag-section-extra{display:flex;align-items:center;gap:8px;min-width:0}',
      '.mp-tag-section-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);white-space:nowrap}',
      '.mp-tag-section-body{display:flex;flex-direction:column;gap:10px;padding:12px}',
      '.mp-tag-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 12px;min-width:0}',
      '.mp-tag-lyrics textarea{min-height:180px;resize:vertical;font-size:12px;line-height:1.65}',
      '.mp-tag-lyrics-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.mp-tag-cover-actions{display:flex;flex-direction:column;gap:8px;min-width:0;align-items:flex-start}',
      '.mp-tag-lyrics-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.mp-match{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:12px;padding:10px;max-height:260px;overflow:auto}',
      '.mp-match-head{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-bottom:6px}',
      '.mp-match-item{display:flex;gap:10px;align-items:center;width:100%;padding:6px 4px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer}',
      '.mp-match-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-match-cover{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));overflow:hidden;flex:none}',
      '.mp-match-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-match-main{min-width:0;flex:1}',
      '.mp-dupe-group{padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-dupe-row{display:flex;gap:8px;align-items:center;font-size:12px;padding:2px 0;min-width:0}',
      '.mp-dupe-row.is-keep{color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-dupe-row.is-drop{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-dupe-meta{margin-left:auto;color:var(--dsw-alias-label-tertiary,#8a8a93);flex:none;font-variant-numeric:tabular-nums}',
      '.mp-lyr-candidates{display:flex;flex-direction:column;gap:4px;max-height:360px;overflow:auto;padding:2px}',
      '.mp-lyr-candidate{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.035));color:inherit;text-align:left;cursor:pointer;width:100%;box-sizing:border-box}',
      '.mp-lyr-candidate:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.14))}',
      '.mp-lyr-candidate-main{min-width:0;flex:1}',
      '.mp-lyr-preview-wrap{display:flex;flex-direction:column;gap:8px;min-width:0}',
      '.mp-lyr-preview-head{display:flex;align-items:center;gap:10px;min-width:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.035))}',
      '.mp-lyr-preview-meta{min-width:0;flex:1}',
      '.mp-lyr-preview-title{font-size:13px;line-height:18px;font-weight:650;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-lyr-preview-artist{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}',
      '.mp-lyr-preview-count{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);white-space:nowrap;flex:none}',
      '.mp-lyr-preview{max-height:360px;overflow:auto;display:flex;flex-direction:column;gap:2px;padding:2px 4px;scrollbar-width:thin}',
      '.mp-lyr-line{display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px;align-items:start;padding:7px 8px;border-radius:8px;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-lyr-line:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-lyr-line.is-meta{padding-top:4px;padding-bottom:4px;opacity:.62}',
      '.mp-lyr-time{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}',
      '.mp-lyr-copy{min-width:0}',
      '.mp-lyr-orig{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#f4f4f5);overflow-wrap:anywhere}',
      '.mp-lyr-tr{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px;overflow-wrap:anywhere}',
      '.mp-lyr-line.is-meta .mp-lyr-orig{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-weight:500}',
      '.mp-np-offset-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}',
      '.mp-np-setting-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:6px;line-height:1.5}',

      // ── composer / sidebar ──────────────────────────────────────────────────
      '.mp-composer-lyrics{display:flex;align-items:center;gap:6px;box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px));max-width:var(--dsh-composer-card-max-width,100%);margin:0 auto 6px;height:calc(24px + var(--dsh-content-font-delta,0px));padding:0 2px;color:var(--dsw-alias-label-secondary,#cfd3d6);font-family:var(--dsw-font-family,inherit);font-size:calc(12px + var(--dsh-content-font-delta,0px));line-height:calc(20px + var(--dsh-content-font-delta,0px));overflow:hidden;white-space:nowrap}',
      '.mp-composer-lyric-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-label-tertiary,#8a8a93);opacity:.9}',
      '.mp-composer-lyric-icon svg{width:calc(12px + var(--dsh-content-font-delta,0px));height:calc(12px + var(--dsh-content-font-delta,0px))}',
      '.mp-composer-lyric-viewport{position:relative;display:inline-flex;align-items:center;flex:0 1 auto;min-width:0;max-width:100%;height:calc(20px + var(--dsh-content-font-delta,0px));overflow:hidden;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 10%,#000 90%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 10%,#000 90%,transparent 100%)}',
      '.mp-composer-lyric-layer{display:inline-flex;align-items:center;gap:6px;max-width:100%;white-space:nowrap}',
      '.mp-composer-lyric-layer.is-entering{animation:mp-composer-lyric-enter .32s cubic-bezier(.22,.8,.24,1) both}',
      '.mp-composer-lyric-layer.is-leaving{position:absolute;left:0;top:0;animation:mp-composer-lyric-leave .32s cubic-bezier(.22,.8,.24,1) both;pointer-events:none;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-composer-lyric-main{min-width:0;overflow:hidden;text-overflow:ellipsis}',
      '.mp-composer-lyric-trans{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:calc(11px + var(--dsh-content-font-delta-secondary,0px));color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-composer-lyric-trans::before{content:"·";margin-right:5px;opacity:.6}',
      '@keyframes mp-composer-lyric-enter{from{opacity:.25;transform:translate3d(0,100%,0)}to{opacity:1;transform:translate3d(0,0,0)}}',
      '@keyframes mp-composer-lyric-leave{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:.18;transform:translate3d(0,-100%,0)}}',
      '@media (prefers-reduced-motion:reduce){.mp-composer-lyric-layer.is-entering{animation:none}.mp-composer-lyric-layer.is-leaving{display:none;animation:none}}',
      '.mp-composer-lyrics.is-empty{display:none}',
      '.mp-composer-cluster{display:flex;align-items:center;gap:2px}',
      '.mp-cbtn{height:28px;min-width:28px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;cursor:pointer;max-width:150px;overflow:hidden}',
      '.mp-cbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-cbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-side-row{position:relative}',
      '.mp-side-icon{position:static;display:grid;place-items:center;width:16px;height:16px}',
      '.mp-side-extras{position:absolute;right:42px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:1px;padding:0;background:transparent;border:0;box-shadow:none;z-index:1}',
      '.mp-side-wave{display:inline-flex;align-items:flex-end;justify-content:center;gap:2px;width:42px;height:22px;margin:0 3px;flex:none;transform-origin:50% 100%;transition:opacity .3s ease,transform .3s ease}.mp-side-wave.is-fading{opacity:0;transform:scaleY(.15)}',
      '.mp-side-wave i{width:3px;min-height:4px;border-radius:2px;background:linear-gradient(180deg,#9cbcff,#4d7dff);box-shadow:0 0 5px rgba(80,130,255,.35);opacity:1;transition:height .07s linear}',
      '.mp-side-btn{width:20px;height:20px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer;padding:0;flex:none}',
      '.mp-side-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-side-btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176E6);outline-offset:1px}',
      '.mp-side-btn svg{display:block}',
      '.mp-audio-host{position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none}',

      // ── responsive ──────────────────────────────────────────────────────────
      '.mp-trash-list{display:flex;flex-direction:column;max-height:340px;overflow:auto}',
      '.mp-trash-row{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-trash-icon{color:var(--dsw-alias-label-tertiary,#8a8a93);flex:none;display:flex}',
      '.mp-trash-main{min-width:0;flex:1;font-size:13px}',
      '.mp-trash-path{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}',
      '.mp-match-row{display:flex;flex-direction:column;gap:2px}',
      '.mp-match-fields{display:flex;flex-wrap:wrap;gap:4px;padding:0 4px 6px 46px}',
      '.mp-match-chip{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer}',
      '.mp-match-chip:hover{border-color:var(--dsw-alias-state-business-primary,#4176E6);color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-sleep-chip{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}',
      '.mp-headmenu{position:relative;display:inline-flex}',
      '.mp-headmenu-pop{position:absolute;right:0;top:34px;z-index:30;min-width:156px;padding:6px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:12px;background:var(--dsw-menu-surface-fill,rgba(26,26,30,.72));-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px) saturate(1.3));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px) saturate(1.3));box-shadow:var(--dsw-elevation-panel,0 12px 32px rgba(0,0,0,.45))}',
      '.mp-headmenu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font:inherit;font-size:13px;text-align:left;cursor:pointer}',
      '.mp-headmenu-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-headmenu-item.is-on{color:var(--dsw-alias-state-business-primary,#7AAAFF)}',
      '.mp-headmenu-label{flex:1}',
      '.mp-headmenu-hint{color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:11px}',
      '.mp-headmenu-sep{margin:5px 6px;border:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-pill{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary,#a1a1aa);font:inherit;font-size:12px;cursor:pointer;transition:background .15s,color .15s,border-color .15s}',
      '.mp-pill:hover{color:var(--dsw-alias-label-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-pill.is-on{color:var(--dsw-alias-label-primary,#f4f4f5);border-color:var(--dsw-alias-state-business-primary,#4176E6);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176E6) 14%,transparent)}',
      '.mp-pill.is-primary{background:var(--dsw-alias-state-business-primary,#4176E6);border-color:transparent;color:#fff}',
      '.mp-kit-modal{width:min(640px,calc(100vw - 48px))}',
      '.mp-kit-modal.is-sm{width:min(420px,calc(100vw - 48px))}',
      '.mp-kit-content{max-height:min(720px,calc(100vh - 80px))}',
      '.mp-kit-body{display:flex;flex-direction:column;gap:12px;min-height:0}',
      '.mp-kit-text{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',

      '.mp-kit-input{flex:1;height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font:inherit;font-size:13px;outline:none}',
      '.mp-kit-center{display:flex;flex-direction:column;align-items:center;gap:8px}',
      '.mp-kit-modal.mp-kit-modal-headless{width:min(760px,calc(100vw - 48px));height:min(560px,calc(100vh - 96px));max-width:none;max-height:none;background:transparent;border:0;box-shadow:none;padding:0}',

      '.mp-nav-head{display:flex;align-items:center;justify-content:space-between;gap:4px;padding-right:6px}',
      '.mp-nav-head .mp-nav-label{flex:1;min-width:0;padding:0 0 6px 10px}',
      '.mp-nav-act{width:20px;height:20px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;flex:none}',
      '.mp-nav-act:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-sec-label{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8a93);font-weight:600;padding:0 2px 0 8px;flex:none}',
      '.mp-sec-act{width:22px;height:22px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;flex:none}',
      '.mp-sec-act:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',

      '.mp-folder-path{padding:2px 0 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#8a8a93);word-break:break-all}',
      '.mp-folder-list{display:flex;flex-direction:column;gap:2px;max-height:320px;overflow:auto}',
      '.mp-folder-row{display:flex;align-items:center;gap:8px;height:32px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font:inherit;font-size:13px;text-align:left;cursor:pointer;min-width:0}',
      '.mp-folder-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-folder-row-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-folder-state{padding:24px 8px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:13px}',


      '.mp-pb-seek-full{position:absolute;left:0;right:0;top:0;height:18px;z-index:4}',
      '.mp-pb-seek-full .mp-seek{height:18px;width:100%}',
      '.mp-pb-seek-full .mp-seek input{height:18px}',
      '.mp-pb-seek-full .mp-seek::before{background:color-mix(in srgb,var(--dsw-alias-label-primary,#f4f4f5) 13%,transparent)}',
      '.mp-pb-time{width:auto;min-width:0;margin-right:4px;white-space:nowrap}',
      '.mp-pb-queue-wrap{position:relative;display:flex;align-items:center}',
      '.mp-queue-pop.is-anchored{position:absolute;left:auto;right:0;bottom:calc(100% + 10px);width:340px;max-height:50vh;z-index:80}',
      '.mp-queue-pop.is-anchored .mp-q-list{max-height:calc(50vh - 56px)}',
      '@media (max-width:1240px){.mp-row{grid-template-columns:48px minmax(0,1.6fr) minmax(0,1fr) 72px 50px 54px}}',
      '@media (max-width:1080px){.mp-row-album{display:none}.mp-row{grid-template-columns:48px minmax(0,1fr) 74px 50px 54px}.mp-workspace.is-queue{grid-template-columns:188px minmax(0,1fr)}.mp-root.is-top .mp-workspace.is-queue{grid-template-columns:minmax(0,1fr)}.mp-queue{display:none!important}}',
      '@media (max-height:860px){.mp-np-reflect-wave{height:30px}.mp-np{--mp-cover:min(31vw,40vh,440px)}.mp-np-body{padding-top:64px}.mp-np-meta{margin-bottom:20px}.mp-np-title{font-size:24px}.mp-np-artist{font-size:13px;margin-top:4px}.mp-np-cover-stage{margin-bottom:12px}.mp-np-quality{margin-bottom:12px;font-size:12px}.mp-np-transport{margin-top:16px;gap:40px}.mp-np-left{padding-bottom:46px}.mp-np-right{padding-bottom:46px}.mp-np-lyrics{padding-top:28px}}',
      '@media (max-width:1100px){.mp-np-body{padding:64px 2.5vw 0 6.5vw}.mp-np-title{font-size:24px}}',
      '@media (max-width:980px){.mp-np{--mp-cover:min(76vw,52vh,680px)}.mp-np-fs{top:14px;right:14px}.mp-np-body{flex-direction:column;gap:0;padding:48px 20px 0;overflow:hidden}.mp-np-meta{margin:0 0 12px}.mp-np-title{font-size:26px}.mp-np-artist{font-size:13px}.mp-np-artist-row{margin-top:4px}.mp-np-meta-audio{top:0}.mp-np-cover-stage{margin-bottom:10px}.mp-np-quality{margin:0 0 12px;font-size:12px}.mp-np-transport{order:2;margin:0;gap:64px}.mp-np-progress{order:3;margin:12px 0 0}.mp-np-times{order:4;margin-top:12px}.mp-np-secondary{order:5;margin:12px 0 0;padding:0 8px}.mp-np-left{width:100%;padding-bottom:8px}.mp-np-right{flex:1;width:100%;max-width:none;margin-left:0;padding-left:0;padding-bottom:16px;min-height:0}.mp-np-lyrics{padding-top:16px}.mp-np-lyric-foot{margin-top:8px}.mp-np-head{top:14px;left:14px}}',
      '@media (max-width:900px){.mp-workspace,.mp-workspace.is-queue{grid-template-columns:56px minmax(0,1fr)}.mp-root.is-top .mp-workspace{grid-template-columns:minmax(0,1fr)}.mp-nav{padding:10px 6px;align-items:center}.mp-nav-label,.mp-nav-item span,.mp-nav-count{display:none}.mp-nav-item{width:40px;justify-content:center;padding:0}.mp-search{width:160px}.mp-pb-vol{display:none}}',

      '@media (max-width:900px){.mp-sheet{width:calc(100vw - 24px);height:min(560px,calc(100dvh - 24px));grid-template-columns:152px minmax(0,1fr)}.mp-sheet-nav{padding:12px 8px}.mp-sheet-body{padding:14px 44px 20px 16px}}',
      '@media (max-width:720px){.mp-sheet-nav{padding-right:48px}.mp-sheet-close{top:8px;right:8px}.mp-sheet{width:calc(100vw - 16px);height:calc(100dvh - 16px);grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.mp-sheet-nav{flex-direction:row;align-items:center;gap:4px;overflow-x:auto;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));padding:8px}.mp-sheet-title{display:none}.mp-sheet-tab{flex:none;white-space:nowrap;height:30px}.mp-sheet-nav>div:last-child{margin-top:0!important;margin-left:auto}.mp-sheet-body{padding:12px 14px 18px}}',
      '@media (max-width:620px){.mp-online-grid{grid-template-columns:1fr}.mp-online-name{font-size:13px}}',
      '@media (max-width:620px){.mp-set-row{flex-direction:column;align-items:stretch;gap:6px}.mp-set-text{flex:0 0 auto}.mp-set-control{justify-content:flex-start;margin-left:0}.mp-set-control select,.mp-range{max-width:100%}}',
      '@media (max-width:620px){.mp-tag-grid{grid-template-columns:1fr}.mp-tag-layout{grid-template-columns:1fr}.mp-tag-aside{position:static;display:grid;grid-template-columns:72px minmax(0,1fr);align-items:center;column-gap:10px;row-gap:3px}.mp-tag-aside .mp-tag-cover{width:72px;height:72px;grid-row:1/4}.mp-tag-aside-title{grid-column:2;grid-row:1}.mp-tag-aside-artist{grid-column:2;grid-row:2}.mp-tag-aside-meta{grid-column:2;grid-row:3}.mp-tag-aside-actions{grid-column:1/-1;flex-direction:row;flex-wrap:wrap}.mp-tag-hint{grid-column:1/-1}.mp-tag-body{max-height:min(68vh,620px)}.mp-tag-footer{flex-wrap:wrap}.mp-tag-footer .mp-btn{flex:1}}',
      '@media (prefers-reduced-motion:reduce){.mp-root *,.mp-root *::before,.mp-root *::after{animation:none!important;transition:none!important}}',
      '@media (prefers-reduced-motion:reduce){.mp-np-line-trans{transition:none}.mp-np.is-trans .mp-np-line-trans{transition:none}}',
    ]

    var THEME_TEXT = THEME_CSS.join('')

    // ── src/ui/01-primitives.js
    /**
     * primitives: the few shared UI atoms plus the player hooks.
     */

    function usePlayerSnapshot() {
      var pair = useState(player.getSnapshot())
      useEffect(function () {
        return player.subscribe(function () {
          pair[1](player.getSnapshot())
        })
      }, [])
      return pair[0]
    }

    function usePlayerTime() {
      var pair = useState(player.getTime())
      useEffect(function () {
        return player.subscribeTime(function () {
          pair[1](player.getTime())
        })
      }, [])
      return pair[0]
    }

    function usePrefs() {
      return useStore(prefsStore)
    }

    /** Milliseconds left until `deadline`, ticking once a second while it is set. */
    function useCountdown(deadline) {
      var pair = useState(Date.now())
      var now = pair[0]
      var setNow = pair[1]
      useEffect(
        function () {
          if (!deadline || deadline <= Date.now()) return undefined
          var timer = setInterval(function () {
            setNow(Date.now())
          }, 1000)
          return function () {
            clearInterval(timer)
          }
        },
        [deadline],
      )
      return Math.max(0, (Number(deadline) || 0) - now)
    }

    function IconButton(props) {
      var button = h(
        'button',
        {
          type: 'button',
          className: cx('mp-iconbtn', props.active === true && 'is-on', props.className),
          title: props.title,
          'aria-label': props.title || props.label || '',
          disabled: props.disabled === true,
          onClick: props.onClick,
          onContextMenu: props.onContextMenu,
        },
        icon(props.icon, props.size || 16),
      )
      var HostTooltip = hostComponent('Tooltip')
      if (props.tooltip !== false && HostTooltip !== null && typeof props.title === 'string' && props.title !== '') {
        return h(HostTooltip, { label: props.title, side: 'bottom', delayMs: 400 }, button)
      }
      return button
    }

    function Button(props) {
      return h(
        'button',
        {
          type: 'button',
          className: cx(
            'mp-btn',
            props.variant === 'primary' && 'is-primary',
            props.variant === 'ghost' && 'is-ghost',
            props.className,
          ),
          disabled: props.disabled === true,
          onClick: props.onClick,
          title: props.title,
        },
        props.icon ? icon(props.icon, 14) : null,
        props.children,
      )
    }

    function Cover(props) {
      var failedPair = useState(false)
      var failed = failedPair[0]
      var setFailed = failedPair[1]
      useEffect(
        function () {
          setFailed(false)
        },
        [props.src],
      )
      var source = failed ? '' : props.src || ''
      return h(
        'div',
        { className: props.className, style: props.style },
        source === ''
          ? icon(props.icon || 'note', props.iconSize || 15)
          : h('img', {
              src: source,
              alt: '',
              loading: 'lazy',
              draggable: false,
              onError: function () {
                setFailed(true)
              },
            }),
      )
    }

    function Spinner() {
      return h('span', { className: 'mp-spinner', 'aria-hidden': 'true' })
    }

    function Empty(props) {
      return h(
        'div',
        { className: 'mp-empty' },
        icon(props.icon || 'note', 26),
        h('strong', null, props.title),
        props.hint ? h('span', null, props.hint) : null,
      )
    }

    function SeekBar(props) {
      var time = usePlayerTime()
      var pair = useState(null)
      var seeking = pair[0]
      var setSeeking = pair[1]
      var duration = time.duration > 0 ? time.duration : props.fallbackDuration || 0
      var position = seeking !== null ? seeking : Math.min(time.currentTime, duration || 0)
      var percent = duration > 0 ? clamp(position / duration, 0, 1) * 100 : 0
      var buffered = Math.min(duration, Math.max(0, Number(time.buffered) || 0))
      var bufferedPercent = duration > 0 ? clamp(buffered / duration, 0, 1) * 100 : 0

      function commit() {
        if (seeking === null) return
        if (duration > 0) player.seek(seeking)
        setSeeking(null)
      }

      function preview(event) {
        if (duration <= 0 || typeof props.onPreview !== 'function') return
        var rect = event.currentTarget.getBoundingClientRect()
        var ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
        props.onPreview(ratio * duration)
      }

      return h(
        'div',
        {
          className: 'mp-seek',
          style: { '--mp-p': percent + '%', '--mp-b': bufferedPercent + '%' },
          onPointerMove: preview,
          onPointerLeave: function () {
            if (typeof props.onPreview === 'function') props.onPreview(null)
          },
        },
        h('span', { className: 'mp-seek-buffer', style: { width: bufferedPercent + '%' } }),
        h('input', {
          type: 'range',
          min: 0,
          max: duration > 0 ? duration : 1,
          step: 0.5,
          value: position,
          disabled: duration <= 0,
          style: { '--mp-p': percent + '%', '--mp-b': bufferedPercent + '%' },
          'aria-label': t('page.duration'),
          onChange: function (event) {
            setSeeking(Number(event.target.value))
          },
          onPointerUp: commit,
          onKeyUp: commit,
          onBlur: commit,
        }),
      )
    }

    function Switch(props) {
      var HostSwitch = hostComponent('Switch')
      if (HostSwitch !== null) {
        return h(HostSwitch, {
          checked: props.value === true,
          onChange: function (next) {
            if (typeof props.onChange === 'function') props.onChange(next === true)
          },
          label: props.label || '',
          title: props.title,
          disabled: props.disabled === true,
        })
      }
      return h(
        'button',
        {
          type: 'button',
          className: cx('mp-switch', props.value === true && 'is-on'),
          role: 'switch',
          'aria-checked': props.value === true,
          'aria-label': props.label || '',
          onClick: function () {
            if (props.onChange) props.onChange(!props.value)
          },
        },
        h('i'),
      )
    }

    function KitPill(props) {
      var HostPill = hostComponent('Pill')
      var content = [
        props.icon ? icon(props.icon, 13) : null,
        h('span', { key: 'label' }, props.children),
      ]
      if (HostPill !== null) {
        return h(
          HostPill,
          {
            active: props.active === true,
            className: props.className,
            title: props.title,
            onClick: props.onClick,
          },
          content,
        )
      }
      return h(
        'button',
        {
          type: 'button',
          className: cx('mp-pill', props.active === true && 'is-on', props.className),
          title: props.title,
          onClick: props.onClick,
        },
        content,
      )
    }

    /**
     * Dialog shell: the host Modal when available (focus trap, Escape, portal,
     * native chrome), otherwise the same overlay markup the plugin used before.
     */
    function KitModal(props) {
      var HostModal = hostComponent('Modal')
      if (HostModal !== null) {
        if (props.headless === true) {
          return h(HostModal, {
            open: true,
            onClose: props.onClose,
            headless: true,
            className: cx('mp-kit-modal', 'mp-kit-modal-headless', props.className),
            children: props.children,
          })
        }
        return h(
          HostModal,
          {
            open: true,
            onClose: props.onClose,
            title: props.title || '',
            closeLabel: t('v2.close'),
            children: h('div', { className: 'mp-kit-body' }, props.children),
            footer: props.footer,
            className: cx('mp-kit-modal', props.small === true && 'is-sm', props.className),
            contentClassName: 'mp-kit-content',
          },
        )
      }
      if (props.headless === true) {
        return h(
          'div',
          { className: 'mp-overlay is-on' },
          h('div', { className: 'mp-scrim', onClick: props.onClose }),
          props.children,
        )
      }
      return h(
        'div',
        { className: 'mp-overlay is-on' },
        h('div', { className: 'mp-scrim', onClick: props.onClose }),
        h(
          'div',
          {
            className: cx('mp-dialog', props.small === true && 'is-sm', props.className),
            role: 'dialog',
            'aria-label': props.title || '',
          },
          h(
            'div',
            { className: 'mp-d-head' },
            h('div', { className: 'mp-d-title' }, props.title || ''),
            props.onClose
              ? h(IconButton, { icon: 'x', size: 15, title: t('v2.close'), onClick: props.onClose })
              : null,
          ),
          h('div', { className: 'mp-d-body' }, props.children),
          props.footer ? h('div', { className: 'mp-d-foot' }, props.footer) : null,
        ),
      )
    }

    function SetRow(props) {
      return h(
        'div',
        { className: 'mp-set-row' },
        h(
          'div',
          { className: 'mp-set-text' },
          h('div', { className: 'mp-set-label' }, props.label),
          props.desc ? h('div', { className: 'mp-set-desc' }, props.desc) : null,
        ),
        h('div', { className: 'mp-set-control' }, props.children),
      )
    }

    // ── src/ui/02-track-row.js
    /**
     * track row / card: one renderer for local tracks, online results and queue
     * rows (the queue uses a compact variant in 05-queue).
     */

    function trackTitleOf(track) {
      if (!track) return ''
      return track.title || stemOf(track.path || '') || basename(track.path || '')
    }

    function trackArtistOf(track) {
      if (!track) return ''
      return track.artist || t('page.unknownArtist')
    }

    function TrackRow(props) {
      var track = props.track
      var current = props.currentPath !== '' && props.currentPath === track.path
      var online = typeof track.onlineProvider === 'string' && track.onlineProvider !== ''
      var vip = track.qualityHint === 'VIP'
      var selecting = props.selectionMode === true
      var selected = props.selected === true

      function play() {
        if (props.onPlay) props.onPlay(track)
      }

      // Single click selects, double click plays (the old 0.11 interaction).
      // The checkbox / Ctrl-click is the additive path.
      function handleClick(event) {
        if (event && event.detail > 1) return
        if (props.onSelect) {
          props.onSelect(track, event ? event.ctrlKey || event.metaKey : false)
          return
        }
        if (selecting) {
          if (props.onToggleSelect) props.onToggleSelect(track.path)
          return
        }
        play()
      }

      return h(
        'div',
        {
          className: cx('mp-row', current && 'is-cur', selected && 'is-selected'),
          role: 'row',
          tabIndex: 0,
          'aria-selected': selected ? 'true' : 'false',
          'aria-label': trackTitleOf(track) + ' · ' + trackArtistOf(track),
          onClick: handleClick,
          onDoubleClick: play,
          onContextMenu: function (event) {
            event.preventDefault()
            if (props.onMenu) props.onMenu(track, event)
          },
          onKeyDown: function (event) {
            if (event.key === 'Enter') play()
          },
        },
        h(
          'div',
          { className: 'mp-row-cover' },
          h(Cover, { src: trackCoverSrc(track), iconSize: 15 }),
          h(
            'button',
            {
              type: 'button',
              className: 'mp-cover-play',
              title: t('page.play'),
              onClick: function (event) {
                event.stopPropagation()
                play()
              },
              onDoubleClick: function (event) {
                event.stopPropagation()
              },
            },
            icon('play', 15),
          ),
        ),
        h(
          'div',
          { className: 'mp-row-main' },
          h(
            'div',
            { className: 'mp-row-title' },
            trackTitleOf(track),
            vip ? h('span', { className: 'mp-badge is-vip' }, 'VIP') : null,
            online && props.cached === true
              ? h('span', { className: 'mp-badge is-cache', title: t('v2.cached') }, icon('download', 10))
              : null,
            current && props.playing === true
              ? h('span', { className: 'mp-eq' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 })])
              : null,
          ),
          h(
            'div',
            { className: 'mp-row-sub' },
            props.onArtist && trackArtistNames(track).length > 0
              ? h(
                  'span',
                  { className: 'mp-artist-links' },
                  trackArtistNames(track).map(function (name, index) {
                    return h(
                      'span',
                      { key: name, className: 'mp-artist-piece' },
                      index > 0 ? h('span', { className: 'mp-artist-sep' }, ' / ') : null,
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mp-artist-link',
                          title: name,
                          onClick: function (event) {
                            event.stopPropagation()
                            props.onArtist(track, name)
                          },
                          onDoubleClick: function (event) {
                            event.stopPropagation()
                          },
                        },
                        name,
                      ),
                    )
                  }),
                )
              : trackArtistOf(track),
            props.onAlbum && track.album
              ? h(
                  'span',
                  { className: 'mp-row-sub-album' },
                  ' · ',
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mp-album-link',
                      title: track.album,
                      onClick: function (event) {
                        event.stopPropagation()
                        props.onAlbum(track)
                      },
                      onDoubleClick: function (event) {
                        event.stopPropagation()
                      },
                    },
                    track.album,
                  ),
                )
              : null,
          ),
        ),
        h(
          'div',
          { className: 'mp-row-album' },
          props.onAlbum && track.album
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'mp-album-link',
                  title: track.album,
                  onClick: function (event) {
                    event.stopPropagation()
                    props.onAlbum(track)
                  },
                  onDoubleClick: function (event) {
                    event.stopPropagation()
                  },
                },
                track.album,
              )
            : track.album || '',
        ),
        h('div', { className: 'mp-row-time' }, fmtTime(track.durationSec)),
        h(
          'div',
          { className: 'mp-row-acts' },
          h(IconButton, {
                icon: props.favorite === true ? 'heartFill' : 'heart',
                size: 15,
                className: 'mp-fav',
                active: props.favorite === true,
                title: props.favorite === true ? t('page.unfavorite') : t('page.favorite'),
                onClick: function (event) {
                  event.stopPropagation()
                  if (props.onToggleFavorite) props.onToggleFavorite(track)
                },
              }),
        ),
        h(
          'div',
          { className: 'mp-row-acts' },
          selecting
            ? h(
                'button',
                {
                  type: 'button',
                  className: cx('mp-row-check', selected && 'is-on'),
                  title: t('page.select'),
                  onClick: function (event) {
                    event.stopPropagation()
                    if (props.onToggleSelect) props.onToggleSelect(track.path)
                  },
                },
                selected ? icon('check', 12) : null,
              )
            : h(IconButton, {
                icon: 'more',
                size: 15,
                title: t('page.more'),
                onClick: function (event) {
                  event.stopPropagation()
                  if (props.onMenu) props.onMenu(track, event)
                },
              }),
        ),
      )
    }

    var SCROLL_MEMORY = {}

    function TrackListBody(props) {
      var key = props.resetKey || 'tracks'
      return h(VirtualList, {
        className: 'mp-scroll',
        items: props.items || [],
        rowHeight: 72,
        resetKey: key,
        focusPath: props.focusPath || '',
        initialScroll: SCROLL_MEMORY[key] || 0,
        onScrollTop: function (top) {
          SCROLL_MEMORY[key] = top
        },
        itemKey: function (track, index) {
          return track.path + ':' + index
        },
        empty: props.empty,
        renderRow: function (track) {
          return h(TrackRow, {
            track: track,
            currentPath: props.currentPath || '',
            playing: props.playing === true,
            favorite: props.favoriteSet ? props.favoriteSet[track.path] === true : false,
            cached: props.cachedOf ? props.cachedOf(track) === true : false,
            selectionMode: props.selectionMode === true,
            selected: props.selectedSet ? props.selectedSet[track.path] === true : false,
            onToggleSelect: props.onToggleSelect,
            onSelect: props.onSelect,
            onPlay: props.onPlay,
            onMenu: props.onMenu,
            onToggleFavorite: props.onToggleFavorite,
            onAlbum: props.onAlbum,
            onArtist: props.onArtist,
          })
        },
      })
    }

    function ScrollBox(props) {
      var key = props.resetKey || 'box'
      var ref = useRef(null)
      useEffect(
        function () {
          var element = ref.current
          if (element === null) return undefined
          element.scrollTop = SCROLL_MEMORY[key] || 0
          function onScroll() {
            SCROLL_MEMORY[key] = element.scrollTop
          }
          element.addEventListener('scroll', onScroll, { passive: true })
          return function () {
            element.removeEventListener('scroll', onScroll)
          }
        },
        [key],
      )
      return h('div', { className: 'mp-scroll', ref: ref }, props.children)
    }

    // ── src/ui/03-player-bar.js
    /**
     * player bar: the persistent transport at the bottom of the panel.
     */

    function playerLoopNext(loop) {
      if (loop === 'none') return 'all'
      if (loop === 'all') return 'one'
      return 'none'
    }

    function SleepChip(props) {
      var remaining = useCountdown(props.deadline)
      if (remaining <= 0) return null
      return h(
        'button',
        {
          type: 'button',
          className: 'mp-chip mp-sleep-chip',
          title: t('v2.sleepCancel'),
          onClick: function () {
            setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
          },
        },
        icon('clock', 12),
        fmtClock(remaining / 1000),
      )
    }

    function PlayerBar(props) {
      var snap = usePlayerSnapshot()
      var prefs = usePrefs()
      var time = usePlayerTime()
      var previewPair = useState(null)
      var preview = previewPair[0]
      var setPreview = previewPair[1]
      var current = snap.queue[snap.index] || null
      var onlineLikedPair = useState(false)
      var onlineLiked = onlineLikedPair[0]
      var setOnlineLiked = onlineLikedPair[1]
      var duration = time.duration > 0 ? time.duration : current ? current.durationSec || 0 : 0
      var progressPercent =
        duration > 0 ? clamp(((preview !== null ? preview : time.currentTime) / duration) * 100, 0, 100) : 0
      var favorite = current !== null && props.favoriteSet[current.path] === true

      useEffect(
        function () {
          if (current === null || !current.onlineProvider) return undefined
          var cancelled = false
          getJson(
            API +
              'online/liked?provider=' +
              encodeURIComponent(current.onlineProvider) +
              '&id=' +
              encodeURIComponent(current.onlineId || ''),
          )
            .then(function (body) {
              if (!cancelled) setOnlineLiked(body.liked === true)
            })
            .catch(function () {
              // Not signed in: keep the neutral state.
            })
          return function () {
            cancelled = true
          }
        },
        [current ? current.path : '', current ? current.onlineProvider : '', current ? current.onlineId : ''],
      )

      if (current === null) {
        return h(
          'div',
          { className: 'mp-playerbar is-empty' },
          h(
            'div',
            { className: 'mp-pb-track' },
            h('div', { className: 'mp-pb-cover' }, icon('note', 16)),
            h(
              'div',
              { className: 'mp-pb-meta' },
              h('div', { className: 'mp-pb-title' }, t('page.noTrack')),
              h('div', { className: 'mp-pb-artist' }, t('v2.pickTrack')),
            ),
          ),
          h(
            'div',
            { className: 'mp-pb-center' },
            h(
              'div',
              { className: 'mp-pb-controls' },
              h(IconButton, { icon: 'prev', title: t('page.prev'), disabled: true }),
              h('button', { type: 'button', className: 'mp-pb-play', disabled: true }, icon('play', 15)),
              h(IconButton, { icon: 'next', title: t('page.next'), disabled: true }),
            ),
          ),
          h('div', { className: 'mp-pb-right' }, h(SleepChip, { deadline: prefs.sleepDeadline })),
        )
      }

      return h(
        'div',
        {
          className: 'mp-playerbar',
          onClick: function (event) {
            var target = event.target
            if (target && target.closest && target.closest('button,input,a,[role="slider"],.mp-pb-queue-wrap')) return
            if (props.onOpenNowPlaying) props.onOpenNowPlaying()
          },
        },
        h(
          'div',
          { className: 'mp-pb-seek-full' },
          h(SeekBar, { fallbackDuration: current.durationSec || 0, onPreview: setPreview }),
        ),
        h(
          'div',
          { className: 'mp-pb-track' },
          h(
            'div',
            {
              className: 'mp-pb-cover',
              role: 'button',
              tabIndex: 0,
              title: t('page.openPlayer'),
              onClick: props.onOpenNowPlaying,
              onKeyDown: function (event) {
                if (event.key === 'Enter') props.onOpenNowPlaying()
              },
            },
            h(Cover, { src: trackCoverSrc(current), iconSize: 16 }),
            snap.playing
              ? h('span', { className: 'mp-pb-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
              : null,
          ),
          h(
            'div',
            { className: 'mp-pb-meta' },
            h('div', { className: 'mp-pb-title', title: trackTitleOf(current) }, trackTitleOf(current)),
            h('div', { className: 'mp-pb-artist', title: trackArtistOf(current) }, trackArtistOf(current)),
          ),
          current.onlineProvider
            ? h(IconButton, {
                icon: onlineLiked ? 'heartFill' : 'heart',
                size: 16,
                className: 'mp-pb-fav',
                active: onlineLiked,
                title: onlineLiked ? t('page.unfavorite') : t('page.favorite'),
                onClick: function () {
                  var next = !onlineLiked
                  postJson(API + 'online/like', { provider: current.onlineProvider, song: current, on: next })
                    .then(function () {
                      setOnlineLiked(next)
                      refreshLikedPlaylist(next ? 1 : -1)
                      showToast(next ? t('page.favorite') : t('page.unfavorite'))
                    })
                    .catch(function (error) {
                      showToast(errorText(error))
                    })
                },
              })
            : h(IconButton, {
                icon: favorite ? 'heartFill' : 'heart',
                size: 16,
                className: 'mp-pb-fav',
                active: favorite,
                title: favorite ? t('page.unfavorite') : t('page.favorite'),
                onClick: function () {
                  if (props.onToggleFavorite) props.onToggleFavorite(current)
                },
              }),
        ),
        h(
          'div',
          { className: 'mp-pb-center' },
          h(
            'div',
            { className: 'mp-pb-controls' },
            h(IconButton, {
              icon: 'shuffle',
              size: 17,
              active: snap.order === 'random',
              title: t('page.shuffle'),
              onClick: function () {
                player.setOrder(snap.order === 'random' ? 'list' : 'random')
              },
            }),
            h(IconButton, {
              icon: 'prev',
              size: 17,
              title: t('page.prev'),
              tooltip: false,
              onClick: function () {
                player.prev()
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-pb-play',
                title: snap.playing ? t('page.pause') : t('page.play'),
                'aria-label': snap.playing ? t('page.pause') : t('page.play'),
                onClick: function () {
                  player.toggle()
                },
              },
              icon(snap.playing ? 'pause' : 'play', 15),
            ),
            h(IconButton, {
              icon: 'next',
              size: 17,
              title: t('page.next'),
              tooltip: false,
              onClick: function () {
                player.next()
              },
            }),
            h(IconButton, {
              icon: snap.loop === 'one' ? 'repeatOne' : 'repeat',
              size: 17,
              active: snap.loop !== 'none',
              title:
                snap.loop === 'one'
                  ? t('page.loopOne')
                  : snap.loop === 'all'
                    ? t('page.loopAll')
                    : t('page.loopNone'),
              onClick: function () {
                player.setLoop(playerLoopNext(snap.loop))
              },
            }),
            h(
              'div',
              { className: 'mp-pb-queue-wrap' },
              h(IconButton, {
                icon: 'playlist',
                size: 17,
                active: props.queueOpen,
                title: t('page.queue'),
                onClick: props.onToggleQueue,
              }),
              props.queueOpen
                ? h(QueuePopover, {
                    open: true,
                    anchored: true,
                    snap: snap,
                    onClose: props.onToggleQueue,
                  })
                : null,
            ),
          ),
        ),
        h(
          'div',
          { className: 'mp-pb-right' },
          h(
            'span',
            { className: cx('mp-time', 'mp-pb-time', preview !== null && 'is-preview') },
            fmtClock(preview !== null ? preview : time.currentTime) + ' / ' + fmtClock(duration),
          ),
          h(SleepChip, { deadline: prefs.sleepDeadline }),
          h(IconButton, {
            icon: 'target',
            size: 17,
            title: t('page.locateCurrent'),
            onClick: props.onLocate,
          }),
          h(
            'div',
            { className: 'mp-pb-vol' },
            h(IconButton, {
              icon: snap.muted || snap.volume === 0 ? 'mute' : snap.volume < 0.5 ? 'volumeLow' : 'volume',
              size: 16,
              title: t('page.mute'),
              onClick: function () {
                player.setMuted(!snap.muted)
              },
            }),
            h('input', {
              type: 'range',
              min: 0,
              max: 100,
              value: Math.round((snap.muted ? 0 : snap.volume) * 100),
              style: { '--mp-v': Math.round((snap.muted ? 0 : snap.volume) * 100) + '%' },
              'aria-label': t('page.volume'),
              onChange: function (event) {
                var value = Number(event.target.value) / 100
                if (snap.muted && value > 0) player.setMuted(false)
                player.setVolume(value)
              },
            }),
          ),
          h(IconButton, {
            icon: 'chevronDown',
            size: 17,
            className: 'mp-pb-expand',
            title: t('page.openPlayer'),
            onClick: props.onOpenNowPlaying,
          }),
        ),
      )
    }

    // ── src/ui/04-eq-panel.js
    /**
     * eq-panel: the equalizer surface inside the audio-effects popover.
     *
     * Three tabs, mirroring how desktop players organise this: factory presets,
     * the user's saved curves, and the editor (response curve + faders + preamp).
     * All state lives in prefs through `player.setEq`, so the panel stays a pure
     * view of a single source of truth.
     */

    var EQ_TABS = [
      { id: 'presets', labelKey: 'eq.tabPresets' },
      { id: 'device', labelKey: 'eq.tabDevices' },
      { id: 'mine', labelKey: 'eq.tabMine' },
      { id: 'edit', labelKey: 'eq.tabEdit' },
    ]

    /** One page of the AutoEQ library; "load more" appends the next batch. */
    var EQ_DEVICE_PAGE = 40

    /** AutoEQ stores the measurement rig family; show it in the user's language. */
    function eqFormLabel(form) {
      var value = String(form || '')
      if (value.indexOf('in-ear') !== -1) return t('eq.formInEar')
      if (value.indexOf('over-ear') !== -1) return t('eq.formOverEar')
      if (value.indexOf('earbud') !== -1) return t('eq.formEarbud')
      return value
    }

    function eqFormatDb(value) {
      var db = Number(value) || 0
      if (Math.abs(db) < 0.05) return '0'
      var rounded = Math.round(db)
      // AutoEQ gains land on tenths; show them instead of pretending to be whole.
      var text = Math.abs(db - rounded) < 0.05 ? String(Math.abs(rounded)) : Math.abs(db).toFixed(1)
      return (db > 0 ? '+' : '-') + text
    }

    function eqFrequencyLabel(freq) {
      return freq >= 1000 ? String(freq / 1000) + 'k' : String(freq)
    }

    /** Tiny ten-bar thumbnail of a curve, used in the preset and saved lists. */
    function EqMiniBars(props) {
      var bands = props.bands || []
      return h(
        'span',
        { className: 'mp-eq-bars', 'aria-hidden': 'true' },
        EQ_FREQS.map(function (_, index) {
          var db = clamp(Number(bands[index]) || 0, -EQ_MAX_DB, EQ_MAX_DB)
          return h('i', { key: index, style: { height: Math.round(50 + (db / EQ_MAX_DB) * 50) + '%' } })
        }),
      )
    }

    /** Real magnitude response of the current chain, drawn as a line. */
    function EqCurve(props) {
      var bands = props.bands || []
      var samples = eqCurveSamples(bands, props.preamp, 72, 44100)
      var width = 300
      var height = 64
      var span = EQ_MAX_DB + 6
      var lowLog = Math.log(EQ_MIN_HZ)
      var highLog = Math.log(EQ_MAX_HZ)
      var points = samples.map(function (sample) {
        var x = ((Math.log(sample.freq) - lowLog) / (highLog - lowLog)) * width
        var y = height / 2 - (sample.db / span) * (height / 2)
        return x.toFixed(1) + ',' + clamp(y, 0, height).toFixed(1)
      })
      return h(
        'svg',
        {
          className: 'mp-eq-curve',
          viewBox: '0 0 ' + width + ' ' + height,
          preserveAspectRatio: 'none',
          'aria-hidden': 'true',
        },
        h('line', {
          x1: 0,
          y1: height / 2,
          x2: width,
          y2: height / 2,
          className: 'mp-eq-curve-zero',
          vectorEffect: 'non-scaling-stroke',
        }),
        h('polyline', {
          points: points.join(' '),
          className: 'mp-eq-curve-line',
          vectorEffect: 'non-scaling-stroke',
        }),
      )
    }

    function EqFader(props) {
      return h(
        'div',
        { className: cx('mp-eq-fader', (Number(props.value) || 0) !== 0 && 'is-active') },
        h('span', { className: 'mp-eq-fader-value' }, eqFormatDb(props.value)),
        h('input', {
          type: 'range',
          min: -EQ_MAX_DB,
          max: EQ_MAX_DB,
          step: 0.5,
          value: Number(props.value) || 0,
          'aria-label': props.label + ' Hz',
          title: props.label + ' Hz',
          onChange: function (event) {
            props.onChange(Number(event.target.value))
          },
          onDoubleClick: function () {
            props.onChange(0)
          },
        }),
        h('span', { className: 'mp-eq-fader-label' }, props.label),
      )
    }

    function EqPresetTile(props) {
      return h(
        'button',
        {
          type: 'button',
          className: cx('mp-eq-preset', props.active === true && 'is-on'),
          onClick: props.onClick,
          title: props.title || props.name,
        },
        h('span', { className: 'mp-eq-preset-name' }, props.name),
        props.caption ? h('span', { className: 'mp-eq-preset-caption' }, props.caption) : null,
        h(EqMiniBars, { bands: props.bands }),
      )
    }

    /**
     * audio-effects: one popover with two views.
     *
     * The volume controls and the equalizer are content of the same panel, not two
     * popovers that swap under the button, so the panel keeps its position and
     * chrome while the view changes.
     */

    var AUDIO_FX_VIEWS = [
      { id: 'audio', labelKey: 'page.volume' },
      { id: 'eq', labelKey: 'eq.title' },
    ]

    function AudioEffectsPanel(props) {
      var snap = props.snap || {}
      var prefs = props.prefs || {}
      var track = props.track || null
      var view = props.view === 'eq' ? 'eq' : 'audio'
      var volume = clamp(Number(snap.volume), 0, 1)
      if (!isFinite(volume)) volume = 1
      var muted = snap.muted === true
      var crossfadeOn = crossfadeFadeSeconds(prefs) > 0

      function show(next) {
        if (typeof props.onView === 'function') props.onView(next)
      }

      function toggleCrossfade(value) {
        // A positive value enables the feature; the engine decides the real
        // overlap, this is only its upper bound.
        setPrefs({ crossfadeSeconds: value ? CROSSFADE_MAX_SECONDS : 0 })
      }

      var body =
        view === 'audio'
          ? h(
              'div',
              { className: 'mp-fx-body' },
              h(
                'div',
                { className: 'mp-fx-row' },
                h('span', { className: 'mp-fx-label' }, t('page.volume')),
                h('span', { className: 'mp-fx-value' }, Math.round((muted ? 0 : volume) * 100) + '%'),
              ),
              h('input', {
                type: 'range',
                className: 'mp-range mp-fx-range',
                min: 0,
                max: 1,
                step: 0.01,
                value: volume,
                'aria-label': t('page.volume'),
                onChange: function (event) {
                  player.setVolume(Number(event.target.value))
                },
              }),
              h(
                'div',
                { className: 'mp-np-extra-row' },
                h('span', null, t('settings.volumeNormalize')),
                h(Switch, {
                  value: prefs.normalizeVolume !== false,
                  onChange: function (value) {
                    setPrefs({ normalizeVolume: value })
                  },
                }),
              ),
              h(
                'div',
                { className: 'mp-np-extra-row', title: t('settings.crossfadeHint') },
                h('span', null, t('settings.crossfade')),
                h(Switch, {
                  value: crossfadeOn,
                  label: t('settings.crossfade'),
                  onChange: toggleCrossfade,
                }),
              ),
              // Pinned to the bottom of the fixed-height card so the panel reads as
              // a filled card instead of controls floating in empty space.
              h(
                'div',
                { className: 'mp-fx-hint' },
                track && track.qualityHint ? track.qualityHint : t('online.qualityStandard'),
              ),
            )
          : h(EqPanel, {})

      return h(
        'div',
        { className: 'mp-np-extra-pop is-effects' },
        h(
          'div',
          { className: 'mp-fx-head' },
          h('span', { className: 'mp-fx-title' }, t('page.audioEffects')),
          h(
            'div',
            { className: 'mp-fx-seg', role: 'tablist' },
            AUDIO_FX_VIEWS.map(function (item) {
              return h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': view === item.id,
                  className: cx('mp-fx-seg-btn', view === item.id && 'is-on'),
                  onClick: function () {
                    show(item.id)
                  },
                },
                t(item.labelKey),
              )
            }),
          ),
        ),
        body,
      )
    }

    function EqPanel(props) {
      var prefs = usePrefs()
      var eq = normalizeEqPrefs(prefs)
      var initialTab = props.initialTab
      var tabPair = useState(
        initialTab === 'device' || initialTab === 'mine' || initialTab === 'edit' ? initialTab : 'presets',
      )
      var tab = tabPair[0]
      var setTab = tabPair[1]
      var namingPair = useState(false)
      var naming = namingPair[0]
      var setNaming = namingPair[1]
      var draftPair = useState('')
      var draft = draftPair[0]
      var setDraft = draftPair[1]
      var custom = Array.isArray(prefs.eqCustom) ? prefs.eqCustom : []
      var available = player.getEq().available
      var activePreset = eq.preset === 'device' ? 'device' : eqPresetForBands(eq.bands)

      // ── AutoEQ device search (debounced, cancelled by sequence) ──────────
      var searchPair = useState('')
      var search = searchPair[0]
      var setSearch = searchPair[1]
      var foundPair = useState([])
      var found = foundPair[0]
      var setFound = foundPair[1]
      var loadingPair = useState(false)
      var loading = loadingPair[0]
      var setLoading = loadingPair[1]
      var errorPair = useState('')
      var searchError = errorPair[0]
      var setSearchError = errorPair[1]
      var totalPair = useState(0)
      var total = totalPair[0]
      var setTotal = totalPair[1]
      var morePair = useState(false)
      var loadingMore = morePair[0]
      var setLoadingMore = morePair[1]
      var searchSeq = useRef(0)

      /**
       * One page of the device library. `offset` doubles as the append position:
       * the panel only ever grows the list downward.
       */
      function fetchDevices(text, offset, append) {
        var seq = searchSeq.current + 1
        searchSeq.current = seq
        if (append) setLoadingMore(true)
        else setLoading(true)
        getJson(
          API +
            'eq/presets?q=' +
            encodeURIComponent(text) +
            '&limit=' +
            EQ_DEVICE_PAGE +
            '&offset=' +
            offset,
        )
          .then(function (body) {
            if (searchSeq.current !== seq) return
            var rows = Array.isArray(body.results) ? body.results : []
            setFound(function (previous) {
              return append ? previous.concat(rows) : rows
            })
            setTotal(Number(body.total) || 0)
            setSearchError('')
          })
          .catch(function (error) {
            if (searchSeq.current !== seq) return
            if (!append) setFound([])
            setSearchError(error && error.message ? error.message : t('eq.searchFailed'))
          })
          .then(function () {
            if (searchSeq.current !== seq) return
            setLoading(false)
            setLoadingMore(false)
          })
      }

      useEffect(
        function () {
          if (tab !== 'device') return undefined
          var text = String(search || '').trim()
          // Typing waits for a pause; opening the tab loads the head of the library
          // immediately so the tab always shows profiles, like the preset grid.
          var timer = setTimeout(
            function () {
              fetchDevices(text, 0, false)
            },
            text === '' ? 0 : 220,
          )
          return function () {
            clearTimeout(timer)
          }
        },
        [tab, search],
      )

      function applyDevice(entry) {
        if (!entry || !Array.isArray(entry.bands)) return
        player.setEq({
          bands: entry.bands,
          preset: 'device',
          device: entry.id,
          enabled: true,
        })
      }

      function loadMoreDevices() {
        if (loading || loadingMore) return
        fetchDevices(String(search || '').trim(), found.length, true)
      }

      function usePreset(preset) {
        player.setEq({ preset: preset.id, bands: eqBandsForPreset(preset.id), enabled: true })
      }

      function changeBand(index, value) {
        var bands = eq.bands.slice()
        bands[index] = clamp(Number(value) || 0, -EQ_MAX_DB, EQ_MAX_DB)
        player.setEq({ bands: bands, preset: eqPresetForBands(bands), enabled: true })
      }

      function useSaved(entry) {
        if (entry === null || typeof entry !== 'object') return
        if (!Array.isArray(entry.bands)) return
        player.setEq({
          bands: entry.bands,
          preamp: entry.preamp,
          preset: eqPresetForBands(entry.bands),
          enabled: true,
        })
      }

      function saveCurrent() {
        var name = String(draft || '').trim()
        if (name === '') {
          showToast(t('eq.needName'))
          return
        }
        var entry = {
          id: 'u' + Date.now().toString(36),
          name: name.slice(0, 24),
          bands: eq.bands.slice(),
          preamp: eq.preamp,
          at: Date.now(),
        }
        var list = custom.filter(function (item) {
          return item && item.name !== entry.name
        })
        list.unshift(entry)
        setPrefs({ eqCustom: list.slice(0, EQ_CUSTOM_LIMIT) })
        setNaming(false)
        setDraft('')
        showToast(t('eq.saved'))
      }

      function removeSaved(id) {
        setPrefs({
          eqCustom: custom.filter(function (item) {
            return item && item.id !== id
          }),
        })
      }

      var body = null
      if (tab === 'presets') {
        body = h(
          'div',
          { className: 'mp-eq-grid' },
          EQ_PRESETS.map(function (preset) {
            return h(EqPresetTile, {
              key: preset.id,
              name: eqPresetName(preset),
              bands: eqBandsForPreset(preset.id),
              active: activePreset === preset.id && eq.enabled,
              onClick: function () {
                usePreset(preset)
              },
            })
          }),
        )
      } else if (tab === 'device') {
        // Same tile grid as the factory presets, so the two libraries read alike.
        var deviceTiles = found.map(function (entry) {
          return h(EqPresetTile, {
            key: entry.id,
            name: entry.name,
            caption: entry.source + (entry.form ? ' · ' + eqFormLabel(entry.form) : ''),
            bands: entry.bands,
            active: eq.preset === 'device' && eq.device === entry.id,
            onClick: function () {
              applyDevice(entry)
            },
          })
        })
        var selectedName = ''
        if (eq.preset === 'device' && eq.device !== '') {
          var parts = String(eq.device).split('::')
          selectedName = parts.length > 2 ? parts.slice(2).join('::') : eq.device
        }
        body = h(
          'div',
          { className: 'mp-eq-device' },
          h('input', {
            type: 'text',
            className: 'mp-eq-search',
            value: search,
            placeholder: t('eq.searchDevice'),
            'aria-label': t('eq.searchDevice'),
            onChange: function (event) {
              setSearch(event.target.value)
            },
          }),
          selectedName !== ''
            ? h('div', { className: 'mp-eq-device-current' }, t('eq.deviceCurrent', { name: selectedName }))
            : null,
          h(
            'div',
            { className: 'mp-eq-device-scroll' },
            deviceTiles.length > 0
              ? h('div', { className: 'mp-eq-grid' }, deviceTiles)
              : h(
                  'div',
                  { className: 'mp-eq-empty' },
                  h(
                    'span',
                    { className: 'mp-eq-empty-title' },
                    loading ? t('eq.searching') : searchError !== '' ? searchError : t('eq.searchEmpty'),
                  ),
                ),
          ),
          // Outside the scroll area so it stays reachable however long the list is.
          found.length > 0 && found.length < total
            ? h(
                'button',
                { type: 'button', className: 'mp-eq-more', onClick: loadMoreDevices },
                loadingMore ? t('eq.searching') : t('eq.loadMore'),
              )
            : null,
          total > 0
            ? h('div', { className: 'mp-eq-device-count' }, t('eq.deviceCount', { shown: found.length, total: total }))
            : null,
        )
      } else if (tab === 'mine') {
        body = h(
          'div',
          { className: 'mp-eq-mine' },
          custom.length === 0
            ? h(
                'div',
                { className: 'mp-eq-empty' },
                h('span', { className: 'mp-eq-empty-title' }, t('eq.empty')),
                h('span', { className: 'mp-eq-empty-hint' }, t('eq.emptyHint')),
              )
            : h(
                'div',
                { className: 'mp-eq-saved' },
                custom.map(function (entry) {
                  return h(
                    'div',
                    { key: entry.id, className: 'mp-eq-saved-row' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mp-eq-saved-main',
                        onClick: function () {
                          useSaved(entry)
                        },
                      },
                      h('span', { className: 'mp-eq-saved-name' }, entry.name),
                      h(EqMiniBars, { bands: entry.bands }),
                    ),
                    h(IconButton, {
                      icon: 'trash',
                      size: 13,
                      title: t('eq.delete'),
                      onClick: function () {
                        removeSaved(entry.id)
                      },
                    }),
                  )
                }),
              ),
          naming
            ? h(
                'div',
                { className: 'mp-eq-save-form' },
                h('input', {
                  type: 'text',
                  className: 'mp-kit-input mp-eq-save-input',
                  value: draft,
                  maxLength: 24,
                  autoFocus: true,
                  placeholder: t('eq.savePlaceholder'),
                  onChange: function (event) {
                    setDraft(event.target.value)
                  },
                  onKeyDown: function (event) {
                    if (event.key === 'Enter') saveCurrent()
                    if (event.key === 'Escape') setNaming(false)
                  },
                }),
                h(Button, { onClick: saveCurrent, className: 'mp-eq-save-ok' }, t('eq.save')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-eq-save-cancel',
                    onClick: function () {
                      setNaming(false)
                    },
                  },
                  t('eq.cancel'),
                ),
              )
            : h(
                'button',
                {
                  type: 'button',
                  className: 'mp-eq-add',
                  onClick: function () {
                    setNaming(true)
                  },
                },
                icon('plus', 13),
                h('span', null, t('eq.saveCurrent')),
              ),
        )
      } else {
        body = h(
          'div',
          { className: 'mp-eq-edit' },
          h(EqCurve, { bands: eq.bands, preamp: eq.preamp }),
          h(
            'div',
            { className: 'mp-eq-faders' },
            EQ_FREQS.map(function (freq, index) {
              return h(EqFader, {
                key: freq,
                label: eqFrequencyLabel(freq),
                value: eq.bands[index],
                offset: eq.bands[index],
                onChange: function (value) {
                  changeBand(index, value)
                },
              })
            }),
          ),
          h(
            'div',
            { className: 'mp-eq-preamp' },
            h('span', { className: 'mp-eq-preamp-label' }, t('eq.preamp')),
            h('input', {
              type: 'range',
              min: -EQ_PREAMP_MAX,
              max: EQ_PREAMP_MAX,
              step: 1,
              className: 'mp-range',
              value: eq.preamp,
              'aria-label': t('eq.preamp'),
              onChange: function (event) {
                player.setEq({ preamp: Number(event.target.value), enabled: true })
              },
            }),
            h('span', { className: 'mp-eq-preamp-value' }, eqFormatDb(eq.preamp) + ' dB'),
          ),
          h('div', { className: 'mp-eq-hint' }, t('eq.preampHint')),
          h(
            'div',
            { className: 'mp-eq-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'mp-eq-action',
                onClick: function () {
                  player.setEq({ preset: 'flat', bands: zeroEqBands(), preamp: 0 })
                },
              },
              t('eq.reset'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-eq-action',
                onClick: function () {
                  setTab('mine')
                  setNaming(true)
                },
              },
              t('eq.saveCurrent'),
            ),
          ),
        )
      }

      return h(
        'div',
        { className: 'mp-eqp' },
        h(
          'div',
          { className: 'mp-eq-tabs-row' },
          h(
            'div',
            { className: 'mp-eq-tabs', role: 'tablist' },
            EQ_TABS.map(function (item) {
              return h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': tab === item.id,
                  className: cx('mp-eq-tab', tab === item.id && 'is-on'),
                  onClick: function () {
                    setTab(item.id)
                  },
                },
                t(item.labelKey),
              )
            }),
          ),
          h(Switch, {
            value: eq.enabled,
            label: t('eq.enable'),
            title: t('eq.enable'),
            onChange: function (value) {
              player.setEq({ enabled: value })
            },
          }),
        ),
        eq.enabled && !available ? h('div', { className: 'mp-eq-warn' }, t('eq.unavailable')) : null,
        h('div', { className: 'mp-eq-body' }, body),
      )
    }

    // ── src/ui/04-now-playing.js
    /**
     * now playing: the 0.11.1 full-panel player (square/circular disc, blurred
     * cover backdrop, floating transport panel) rebuilt on the v2 state layer.
     */

    function lyricActiveIndex(lines, seconds) {
      if (!Array.isArray(lines) || lines.length === 0) return -1
      if (lines[0].time < 0) return -1
      var low = 0
      var high = lines.length - 1
      var found = -1
      while (low <= high) {
        var mid = (low + high) >> 1
        if (lines[mid].time <= seconds + 0.05) {
          found = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      }
      return found
    }

    function useLyricAutoScroll(
      boxRef,
      innerRef,
      coverRef,
      rowRefs,
      active,
      lyrics,
      timed,
      open,
      showTranslation,
      lyricSize,
      lyricGap,
      translationScale,
      lyricAlign,
    ) {
      var MANUAL_RETURN_MS = 1500
      var stateRef = useRef(null)
      if (stateRef.current === null) {
        stateRef.current = {
          y: 0,
          target: 0,
          velocity: 0,
          frame: 0,
          last: 0,
          boxH: 0,
          contentH: 0,
          activeTop: 0,
          activeHeight: 0,
          settleUntil: 0,
          active: 0,
          focusShift: 0,
        }
      }
      var s = stateRef.current
      var activeRef = useRef(active)
      activeRef.current = active
      var timedRef = useRef(timed)
      timedRef.current = timed
      // Wheel scrolling pauses the follow animation; clicking a lyric line resumes
      // it at the clicked line. The player itself never changes on wheel.
      var manualRef = useRef(false)
      var manualPair = useState(-1)
      var manualIndex = manualPair[0]
      var setManualIndex = manualPair[1]
      var idleTimerRef = useRef(0)
      var lastRef = useRef({ initialized: false, lyrics: null, open: false, trans: false })

      function clock() {
        return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()
      }
      function raf(callback) {
        return typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(callback)
          : setTimeout(function () {
              callback(clock())
            }, 16)
      }
      function caf(id) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
        else clearTimeout(id)
      }
      function reduced() {
        return (
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
      }
      function measure() {
        var box = boxRef.current
        var inner = innerRef.current
        if (box === null || inner === null) return false
        s.boxH = box.clientHeight
        s.contentH = inner.offsetHeight
        var row = rowRefs.current[s.active]
        if (!row || row.isConnected === false) {
          s.activeTop = 0
          s.activeHeight = 0
          return true
        }
        // Measure against the box while cancelling the current translate: offsetTop
        // excludes the lyrics box padding, which made the target drift by ~78px.
        var rowRect = row.getBoundingClientRect()
        var boxRect = box.getBoundingClientRect()
        s.activeTop = rowRect.top - boxRect.top + s.y
        s.activeHeight = rowRect.height
        // On the two-column layout, centre the active line on the cover's centre
        // instead of the lyrics viewport's centre. On stacked/narrow layouts the
        // cover sits above the lyrics, so the shift stays 0.
        s.focusShift = 0
        var cover = coverRef.current
        if (cover !== null) {
          var coverRect = cover.getBoundingClientRect()
          if (coverRect.bottom > boxRect.top && coverRect.top < boxRect.bottom) {
            var shift = coverRect.top + coverRect.height / 2 - (boxRect.top + s.boxH / 2)
            var limit = Math.max(0, s.boxH / 2 - s.activeHeight / 2 - 8)
            s.focusShift = Math.max(-limit, Math.min(limit, shift))
          }
        }
        return true
      }
      function targetFor() {
        // Always centre the active line, including the first and last one. On the
        // two-column layout the centre is the cover's centre, not the box centre.
        return s.activeTop - (s.boxH / 2 - s.activeHeight / 2) - s.focusShift
      }
      function write() {
        var inner = innerRef.current
        if (inner !== null) inner.style.transform = 'translate3d(0,' + -s.y + 'px,0)'
      }
      function stop() {
        if (s.frame !== 0) {
          caf(s.frame)
          s.frame = 0
        }
      }
      function clearReturnTimer() {
        if (idleTimerRef.current !== 0) {
          clearTimeout(idleTimerRef.current)
          idleTimerRef.current = 0
        }
      }
      function nearestRowIndex() {
        var box = boxRef.current
        var rows = rowRefs.current
        if (box === null || !Array.isArray(rows) || rows.length === 0) return -1
        var boxRect = box.getBoundingClientRect()
        var centerY = boxRect.top + boxRect.height / 2 + s.focusShift
        var best = -1
        var bestDiff = Infinity
        for (var i = 0; i < rows.length; i += 1) {
          var row = rows[i]
          if (!row || row.isConnected === false) continue
          var rowRect = row.getBoundingClientRect()
          var diff = Math.abs(rowRect.top + rowRect.height / 2 - centerY)
          if (diff < bestDiff) {
            best = i
            bestDiff = diff
          }
        }
        return best
      }
      function resumeFollow(index) {
        clearReturnTimer()
        manualRef.current = false
        setManualIndex(-1)
        if (timedRef.current !== true) return
        s.active = Number.isInteger(index) && index >= 0
          ? index
          : activeRef.current >= 0 ? activeRef.current : 0
        s.velocity = 0
        s.settleUntil = 0
        if (!measure()) return
        s.target = targetFor()
        kick()
      }
      function armReturnTimer() {
        clearReturnTimer()
        idleTimerRef.current = setTimeout(function () {
          idleTimerRef.current = 0
          if (manualRef.current) resumeFollow()
        }, MANUAL_RETURN_MS)
      }
      function frame(nowMs) {
        s.frame = 0
        var dt = s.last > 0 ? Math.min((nowMs - s.last) / 1000, 0.032) : 0.016
        s.last = nowMs
        if (nowMs < s.settleUntil) {
          // While the translation rows animate, pin the active line to the moving
          // target instead of letting the spring lag behind the reflow.
          if (measure()) s.target = targetFor()
          s.y = s.target
          s.velocity = 0
          write()
          s.frame = raf(frame)
          return
        }
        var stiffness = 240
        var damping = 34
        var force = -stiffness * (s.y - s.target) - damping * s.velocity
        s.velocity += force * dt
        s.y += s.velocity * dt
        var done = Math.abs(s.y - s.target) < 0.2 && Math.abs(s.velocity) < 0.2
        if (done) {
          s.y = s.target
          s.velocity = 0
        }
        write()
        if (done && nowMs >= s.settleUntil) {
          s.last = 0
          return
        }
        s.frame = raf(frame)
      }
      function kick() {
        if (reduced()) {
          stop()
          s.y = s.target
          s.velocity = 0
          write()
          return
        }
        if (s.frame === 0) {
          s.last = 0
          s.frame = raf(frame)
        }
      }
      function onResize() {
        var inner = innerRef.current
        if (inner === null) return
        if (timedRef.current !== true) {
          stop()
          inner.style.transform = ''
          return
        }
        if (manualRef.current) {
          measure()
          return
        }
        s.active = activeRef.current >= 0 ? activeRef.current : 0
        if (!measure()) return
        s.target = targetFor()
        kick()
      }

      useEffect(
        function () {
          var inner = innerRef.current
          var observer =
            typeof ResizeObserver === 'function' && inner !== null ? new ResizeObserver(onResize) : null
          if (observer !== null) {
            observer.observe(inner)
            var cover = coverRef.current
            if (cover !== null) observer.observe(cover)
          }
          window.addEventListener('resize', onResize)
          return function () {
            stop()
            if (observer !== null) observer.disconnect()
            window.removeEventListener('resize', onResize)
          }
        },
        [lyrics.length],
      )

      useEffect(
        function () {
          var box = boxRef.current
          var inner = innerRef.current
          if (box === null || inner === null) return undefined
          function onWheel(event) {
            if (timedRef.current !== true) return
            if (event.ctrlKey) return // leave browser zoom alone
            event.preventDefault()
            manualRef.current = true
            stop()
            s.velocity = 0
            s.boxH = box.clientHeight
            s.contentH = inner.offsetHeight
            measure()
            var delta = Number(event.deltaY) || 0
            if (event.deltaMode === 1) delta *= 16
            else if (event.deltaMode === 2) delta *= s.boxH
            var minY = -Math.max(40, s.boxH * 0.75)
            var maxY = Math.max(minY, s.contentH - s.boxH * 0.5)
            s.y = Math.max(minY, Math.min(maxY, s.y + delta))
            write()
            var focus = nearestRowIndex()
            if (focus >= 0) setManualIndex(focus)
            armReturnTimer()
          }
          box.addEventListener('wheel', onWheel, { passive: false })
          return function () {
            clearReturnTimer()
            box.removeEventListener('wheel', onWheel, { passive: false })
          }
        },
        [lyrics.length, open],
      )

      useLayoutEffect(
        function () {
          var inner = innerRef.current
          if (inner === null) return
          if (timed !== true || lyrics.length === 0) {
            manualRef.current = false
            clearReturnTimer()
            setManualIndex(-1)
            stop()
            s.y = 0
            s.target = 0
            s.velocity = 0
            inner.style.transform = ''
            return
          }
          var prev = lastRef.current
          var reset = prev.initialized !== true || prev.lyrics !== lyrics || (prev.open !== true && open === true)
          var settle = prev.initialized === true && prev.trans !== showTranslation
          lastRef.current = { initialized: true, lyrics: lyrics, open: open, trans: showTranslation }
          if (reset) {
            manualRef.current = false
            clearReturnTimer()
            setManualIndex(-1)
          }
          s.active = active >= 0 ? active : 0
          if (!measure()) return
          if (manualRef.current) return
          s.target = targetFor()
          if (reset || Math.abs(s.target - s.y) > s.boxH * 3) {
            stop()
            s.y = s.target
            s.velocity = 0
            write()
            return
          }
          if (settle) s.settleUntil = clock() + 480
          kick()
        },
        [active, lyrics, open, showTranslation, lyricSize, lyricGap, translationScale, lyricAlign, timed],
      )

      return {
        manualIndex: manualIndex,
        isManual: function () {
          return manualRef.current
        },
        resume: resumeFollow,
      }
    }

    function NpEditor(props) {
      var prefs = usePrefs()
      var cover = typeof props.cover === 'string' ? props.cover : ''
      var resetPair = useState(false)
      var resetConfirm = resetPair[0]
      var setResetConfirm = resetPair[1]

      useEffect(
        function () {
          if (props.open !== true) return undefined
          function onKey(event) {
            if (event.key === 'Escape') props.onClose()
          }
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('keydown', onKey)
          }
        },
        [props.open],
      )

      useEffect(
        function () {
          if (props.open !== true) setResetConfirm(false)
        },
        [props.open],
      )

      if (props.open !== true) return null

      function chooseCover(style) {
        setPrefs({
          coverStyle: style,
          circularCover: style === 'vinyl',
          vinylRing: style === 'vinyl',
          coverSpin: style === 'vinyl',
        })
      }

      function resetDefaults() {
        setPrefs({
          coverStyle: 'square',
          circularCover: false,
          vinylRing: false,
          coverSpin: false,
          lyricSize: 35,
          lyricGap: 15,
          translationScale: 90,
          lyricAlign: 'left',
          lyricBlur: true,
          waveEnabled: true,
          showTranslation: true,
          lyricOrder: ['embedded', 'lrc'],
        })
      }

      function sectionHead(label) {
        return h(
          'div',
          { className: 'mp-npe-sec-head' },
          h('span', { className: 'mp-npe-sec-title' }, label),
          h('span', { className: 'mp-npe-sec-line' }),
        )
      }

      function coverPreview(style) {
        if (cover === '') return icon('note', 22)
        if (style === 'vinyl') return h('img', { src: cover, alt: '' })
        return h('img', { src: cover, alt: '' })
      }

      function coverCard(style, label) {
        var selected = style === 'vinyl' ? prefs.coverStyle === 'vinyl' : prefs.coverStyle !== 'vinyl'
        return h(
          'button',
          {
            type: 'button',
            className: cx('mp-npe-cover-card', selected && 'is-on'),
            'aria-pressed': selected ? 'true' : 'false',
            onClick: function () {
              chooseCover(style)
            },
          },
          h(
            'span',
            {
              className: cx(
                'mp-npe-cover-preview',
                style === 'vinyl' ? 'mp-npe-cover-vinyl' : 'mp-npe-cover-square',
              ),
            },
            coverPreview(style),
          ),
          h('span', { className: 'mp-npe-cover-label' }, label),
          selected ? h('span', { className: 'mp-npe-cover-check' }, icon('check', 12)) : null,
        )
      }

      function rangeRow(label, value, min, max, step, unit, apply) {
        return h(
          'div',
          { className: 'mp-npe-row' },
          h(
            'div',
            { className: 'mp-npe-range-head' },
            h('span', null, label),
            h('span', { className: 'mp-npe-val' }, value + unit),
          ),
          h('input', {
            type: 'range',
            className: 'mp-range',
            min: min,
            max: max,
            step: step,
            value: value,
            onChange: function (event) {
              apply(Number(event.target.value))
            },
          }),
        )
      }

      function switchRow(label, value, apply) {
        return h(
          'div',
          { className: 'mp-npe-switch-row' },
          h('span', null, label),
          h(Switch, { value: value, onChange: apply }),
        )
      }

      return h(
        'div',
        {
          className: 'mp-npe',
          onClick: function (event) {
            if (event.target === event.currentTarget) props.onClose()
          },
        },
        h(
          'div',
          {
            className: 'mp-npe-panel',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('editor.title'),
          },
          h(
            'div',
            { className: 'mp-npe-head' },
            h(
              'div',
              { className: 'mp-npe-head-text' },
              h('div', { className: 'mp-npe-title' }, t('editor.title')),
              h('div', { className: 'mp-npe-sub' }, t('editor.subtitle')),
            ),
            h(
              'div',
              { className: 'mp-npe-head-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mp-npe-head-btn',
                  title: t('editor.reset'),
                  'aria-label': t('editor.reset'),
                  onClick: function () {
                    setResetConfirm(true)
                  },
                },
                icon('refresh', 16),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mp-npe-close',
                  title: t('editor.close'),
                  'aria-label': t('editor.close'),
                  onClick: props.onClose,
                },
                icon('x', 18),
              ),
            ),
          ),
          resetConfirm
            ? h(
                'div',
                { className: 'mp-npe-confirm' },
                h(
                  'div',
                  { className: 'mp-npe-confirm-text' },
                  h('div', { className: 'mp-npe-confirm-title' }, t('editor.resetConfirm')),
                  h('div', { className: 'mp-npe-confirm-hint' }, t('editor.resetHint')),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-npe-confirm-btn',
                    onClick: function () {
                      setResetConfirm(false)
                    },
                  },
                  t('editor.cancel'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-npe-confirm-btn is-primary',
                    onClick: function () {
                      resetDefaults()
                      setResetConfirm(false)
                    },
                  },
                  t('editor.reset'),
                ),
              )
            : null,
          h(
            'div',
            { className: 'mp-npe-body' },
            h(
              'div',
              { className: 'mp-npe-section' },
              sectionHead(t('editor.cover')),
              h(
                'div',
                { className: 'mp-npe-cover-grid' },
                coverCard('square', t('v2.coverSquare')),
                coverCard('vinyl', t('v2.coverVinyl')),
              ),
            ),
            h(
              'div',
              { className: 'mp-npe-section' },
              sectionHead(t('editor.type')),
              rangeRow(t('page.lyricSize'), prefs.lyricSize || 25, 14, 40, 1, ' px', function (value) {
                setPrefs({ lyricSize: value })
              }),
              rangeRow(t('page.lyricGap'), Number(prefs.lyricGap) || 10, 2, 16, 1, ' px', function (value) {
                setPrefs({ lyricGap: value })
              }),
              rangeRow(
                t('page.translationScale'),
                prefs.translationScale || 100,
                50,
                100,
                5,
                '%',
                function (value) {
                  setPrefs({ translationScale: value })
                },
              ),
              h(
                'div',
                { className: 'mp-npe-row' },
                h('div', { className: 'mp-npe-range-head' }, h('span', null, t('settings.lyricAlign'))),
                h(
                  'div',
                  { className: 'mp-npe-seg' },
                  [
                    ['left', 'settings.alignLeft'],
                    ['center', 'settings.alignCenter'],
                    ['right', 'settings.alignRight'],
                  ].map(function (item) {
                    return h(
                      'button',
                      {
                        key: item[0],
                        type: 'button',
                        className: cx('mp-npe-seg-btn', (prefs.lyricAlign || 'left') === item[0] && 'is-on'),
                        onClick: function () {
                          setPrefs({ lyricAlign: item[0] })
                        },
                      },
                      t(item[1]),
                    )
                  }),
                ),
              ),
            ),
            h(
              'div',
              { className: 'mp-npe-section' },
              sectionHead(t('editor.display')),
              switchRow(t('page.translation'), prefs.showTranslation === true, function (value) {
                setPrefs({ showTranslation: value })
              }),
              switchRow(t('page.lyricBlur'), prefs.lyricBlur === true, function (value) {
                setPrefs({ lyricBlur: value })
              }),
              switchRow(t('editor.wave'), prefs.waveEnabled !== false, function (value) {
                setPrefs({ waveEnabled: value })
              }),
              h(
                'div',
                { className: 'mp-npe-row' },
                h(
                  'div',
                  { className: 'mp-npe-range-head' },
                  h('span', null, t('settings.lyricOrder')),
                ),
                h(
                  'select',
                  {
                    value: (prefs.lyricOrder || ['embedded', 'lrc']).join(','),
                    onChange: function (event) {
                      setPrefs({ lyricOrder: event.target.value.split(',') })
                    },
                  },
                  h('option', { value: 'embedded,lrc' }, t('settings.lyricSourceEmbedded') + ' → LRC'),
                  h('option', { value: 'lrc,embedded' }, 'LRC → ' + t('settings.lyricSourceEmbedded')),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'mp-npe-foot' },
            h(
              'button',
              { type: 'button', className: 'mp-npe-btn is-primary', onClick: props.onClose },
              t('editor.done'),
            ),
          ),
        ),
      )
    }

    function fallbackCoverAccent() {
      var h = 40
      var sat = 12
      var light = 70
      return {
        h: h,
        s: sat,
        l: light,
        palette: [
          { h: 28, s: 10, l: 62 },
          { h: h, s: sat, l: light },
          { h: 52, s: 14, l: 78 },
        ],
      }
    }

    function rgbToHslColor(red, green, blue) {
      var r = red / 255
      var g = green / 255
      var b = blue / 255
      var max = Math.max(r, g, b)
      var min = Math.min(r, g, b)
      var d = max - min
      var l = (max + min) / 2
      var s = 0
      var h = 0
      if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        if (max === r) h = ((g - b) / d) % 6
        else if (max === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        h *= 60
        if (h < 0) h += 360
      }
      return { h: h, s: s, l: l }
    }

    function coverAccentFromUrl(url, image) {
      return new Promise(function (resolve) {
        if (!url) {
          resolve(fallbackCoverAccent())
          return
        }
        var img = image || new Image()
        img.onload = function () {
          try {
            var canvas = document.createElement('canvas')
            canvas.width = 24
            canvas.height = 24
            var ctx = canvas.getContext('2d', { willReadFrequently: true })
            ctx.drawImage(img, 0, 0, 24, 24)
            var data = ctx.getImageData(0, 0, 24, 24).data
            var buckets = new Map()
            for (var i = 0; i < data.length; i += 4) {
              if (data[i + 3] < 128) continue
              var red = data[i]
              var green = data[i + 1]
              var blue = data[i + 2]
              var key = (red >> 4) + ',' + (green >> 4) + ',' + (blue >> 4)
              var entry = buckets.get(key)
              if (entry === undefined) {
                entry = { count: 0, r: 0, g: 0, b: 0 }
                buckets.set(key, entry)
              }
              entry.count += 1
              entry.r += red
              entry.g += green
              entry.b += blue
            }
            var colors = []
            buckets.forEach(function (entry) {
              var color = rgbToHslColor(entry.r / entry.count, entry.g / entry.count, entry.b / entry.count)
              colors.push({ h: color.h, s: color.s, l: color.l, count: entry.count })
            })
            colors.sort(function (a, b) {
              return b.count - a.count
            })
            var picked = []
            for (var c = 0; c < colors.length && picked.length < 3; c += 1) {
              var candidate = colors[c]
              var distinct = true
              for (var p = 0; p < picked.length; p += 1) {
                var other = picked[p]
                var hueGap = Math.min(
                  Math.abs(candidate.h - other.h),
                  360 - Math.abs(candidate.h - other.h),
                ) / 360
                var distance = Math.hypot(hueGap, candidate.s - other.s, candidate.l - other.l)
                if (distance < 0.16) {
                  distinct = false
                  break
                }
              }
              if (distinct) picked.push(candidate)
            }
            if (picked.length === 0) {
              resolve(fallbackCoverAccent())
              return
            }
            while (picked.length < 3) {
              var base = picked[0]
              picked.push({
                h: (base.h + (picked.length === 1 ? 32 : 328)) % 360,
                s: base.s,
                l: Math.min(0.8, Math.max(0.38, base.l + (picked.length === 1 ? 0.08 : -0.06))),
                count: 0,
              })
            }
            if (colors.length === 0) {
              resolve(fallbackCoverAccent())
              return
            }
            // Signature colour: among reasonably saturated clusters, prefer area
            // times saturation. This ignores both a large cream background and a
            // tiny saturated JPEG fringe (which used to win and turn the wave blue).
            var maxCount = colors.reduce(function (max, color) {
              return Math.max(max, color.count || 1)
            }, 1)
            var minCount = Math.max(3, Math.floor(maxCount * 0.02))
            var saturated = colors.filter(function (color) {
              return (
                color.s > 0.3 &&
                color.l > 0.06 &&
                color.l < 0.92 &&
                Math.max(1, color.count || 1) >= minCount
              )
            })
            var pool = saturated.length > 0 ? saturated : colors
            var base = pool.reduce(function (best, color) {
              return color.s > best.s ? color : best
            }, pool[0])
            var feature = []
            function addFeature(source) {
              var candidate = {
                h: Math.round(source.h),
                s: Math.round(Math.min(1, Math.max(0.16, source.s)) * 100),
                l: Math.round(Math.min(0.82, Math.max(0.38, source.l)) * 100),
              }
              for (var f = 0; f < feature.length; f += 1) {
                var other = feature[f]
                var hueGap = Math.min(
                  Math.abs(candidate.h - other.h),
                  360 - Math.abs(candidate.h - other.h),
                ) / 360
                if (Math.hypot(hueGap, (candidate.s - other.s) / 100, (candidate.l - other.l) / 100) < 0.16) {
                  return
                }
              }
              feature.push(candidate)
            }
            addFeature(base)
            for (var f = 0; f < picked.length; f += 1) addFeature(picked[f])
            // Hard bound the fallback loop. addFeature() may reject a generated
            // neighbour as too similar, so looping on it can spin forever on
            // low-colour artwork and freeze the panel while extracting the cover.
            var featureGuard = 0
            while (feature.length < 3 && featureGuard < 12) {
              var anchor = feature[0] || { h: 40, s: 16, l: 70 }
              var angle = (featureGuard + 1) * 30
              feature.push({
                h: (anchor.h + angle) % 360,
                s: Math.max(16, anchor.s),
                l: Math.min(82, Math.max(38, anchor.l + (featureGuard % 2 === 0 ? 8 : -6))),
              })
              featureGuard += 1
            }
            feature = feature.slice(0, 4).sort(function (a, b) {
              return a.h - b.h
            })
            resolve({
              h: Math.round(base.h),
              s: Math.round(Math.min(1, Math.max(0.16, base.s)) * 100),
              l: Math.round(Math.min(0.82, Math.max(0.38, base.l)) * 100),
              palette: feature,
            })
          } catch (error) {
            resolve(fallbackCoverAccent())
          }
        }
        img.onerror = function () {
          resolve(fallbackCoverAccent())
        }
        if (image) {
          if (img.complete) {
            if (img.naturalWidth > 0) img.onload()
            else img.onerror()
          }
        } else {
          img.src = url
        }
      })
    }

    function useCoverAccent(url, imageRef) {
      var pair = useState(fallbackCoverAccent())
      var accent = pair[0]
      var setAccent = pair[1]
      useEffect(
        function () {
          var cancelled = false
          var timer = null
          var tries = 0
          function attempt() {
            if (cancelled) return
            var image = imageRef && imageRef.current ? imageRef.current : null
            if (image === null) {
              if (tries < 20) {
                tries += 1
                timer = setTimeout(attempt, 50)
                return
              }
              setAccent(fallbackCoverAccent())
              return
            }
            // Sample only the <img> already rendered by the player. Online covers
            // are served from the Host's local cache; this never makes a second
            // request.
            coverAccentFromUrl(url, image).then(function (next) {
              if (!cancelled) setAccent(next)
            })
          }
          attempt()
          return function () {
            cancelled = true
            if (timer !== null) clearTimeout(timer)
          }
        },
        [url, imageRef],
      )
      return accent
    }

    function createBlurredBackdrop(url) {
      return new Promise(function (resolve) {
        if (!url) {
          resolve('')
          return
        }
        var img = new Image()
        img.onload = function () {
          try {
            var size = 64
            var canvas = document.createElement('canvas')
            canvas.width = size
            canvas.height = size
            var ctx = canvas.getContext('2d')
            if (ctx === null) {
              resolve('')
              return
            }
            // Blur once at 64x64 instead of applying a 110px blur to a full-screen
            // image on every raster. Upscaling this texture is visually close and
            // orders of magnitude cheaper.
            if (typeof ctx.filter === 'string') {
              ctx.filter = 'blur(4px) saturate(1.6) brightness(.68)'
            }
            ctx.drawImage(img, 0, 0, size, size)
            if (typeof ctx.filter === 'string') ctx.filter = 'none'
            resolve(canvas.toDataURL('image/jpeg', 0.82))
          } catch (error) {
            resolve('')
          }
        }
        img.onerror = function () {
          resolve('')
        }
        img.src = url
      })
    }

    function CoverReflectWave(props) {
      var accent = useCoverAccent(props.cover || '', props.imageRef)
      var playing = props.playing === true
      var active = props.active !== false
      var ref = useRef(null)
      useEffect(
        function () {
          var canvas = ref.current
          if (canvas === null) return undefined
          var ctx = canvas.getContext('2d')
          if (ctx === null) return undefined
          if (playing !== true || active !== true) {
            // Keep the last painted frame while CSS scales/fades the canvas out.
            var clearTimer = setTimeout(function () {
              var node = ref.current
              if (node === null) return
              var clearCtx = node.getContext('2d')
              if (clearCtx !== null) clearCtx.clearRect(0, 0, node.width, node.height)
            }, 420)
            return function () {
              clearTimeout(clearTimer)
            }
          }
          var dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
          var frame = 0
          var last = 0
          var levels = []
          var bands = 32
          var spectrumBands = 16
          function resize() {
            // clientWidth/Height use the layout box, not the CSS fade transform.
            // Measuring getBoundingClientRect() while is-fading scales the canvas
            // to 12% and makes the backing store permanently too small on resume.
            canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
            canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
          }
          resize()
          var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
          if (observer !== null) observer.observe(canvas)
          window.addEventListener('resize', resize)
          function colorOf(c, alpha) {
            return 'hsla(' + c.h + ',' + c.s + '%,' + c.l + '%,' + alpha + ')'
          }
          var palette =
            Array.isArray(accent.palette) && accent.palette.length > 1 ? accent.palette : [accent]
          function draw(now) {
            frame = 0
            if (now - last < 33) {
              frame = requestAnimationFrame(draw)
              return
            }
            last = now
            var w = canvas.width / dpr
            var h = canvas.height / dpr
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, w, h)
            var data = playing ? player.getWave() : null
            var raw = []
            if (data !== null && data.length > 0) {
              for (var band = 0; band < spectrumBands; band += 1) {
                var start = Math.floor(Math.pow(band / spectrumBands, 1.6) * data.length)
                var end = Math.max(start + 1, Math.floor(Math.pow((band + 1) / spectrumBands, 1.6) * data.length))
                end = Math.min(end, data.length)
                var sum = 0
                for (var i = start; i < end; i += 1) sum += data[i]
                raw.push((sum / Math.max(1, end - start)) / 255)
              }
            } else {
              for (var z = 0; z < spectrumBands; z += 1) raw.push(0)
            }
            var peak = 0.4
            for (var p = 0; p < raw.length; p += 1) peak = Math.max(peak, raw[p])
            var barW = Math.max(1, (w / bands) * 0.58)
            var gap = w / bands
            function mixFeature(list, t) {
              if (!list.length) return accent
              if (list.length === 1) return list[0]
              var scaled = (((t % 1) + 1) % 1) * list.length
              var from = Math.floor(scaled) % list.length
              var to = (from + 1) % list.length
              var frac = scaled - Math.floor(scaled)
              var a = list[from]
              var b = list[to]
              var hueDelta = ((b.h - a.h + 540) % 360) - 180
              return {
                h: (a.h + hueDelta * frac + 360) % 360,
                s: a.s + (b.s - a.s) * frac,
                l: a.l + (b.l - a.l) * frac,
              }
            }
            var phase = (now / 16000) % 1
            ctx.globalAlpha = 0.92
            var mid = (bands - 1) / 2
            for (var k = 0; k < bands; k += 1) {
              var dist = Math.abs(k - mid) / mid
              var bandIndex = Math.min(spectrumBands - 1, Math.round(dist * (spectrumBands - 1)))
              var level = Math.pow(Math.max(0, raw[bandIndex]) / peak, 1.5)
              level = 0.02 + Math.min(1, level) * 0.98
              var prev = levels[k] || 0
              levels[k] = level > prev ? level : prev * 0.45 + level * 0.55
              var half = (levels[k] * h) / 2
              if (half < 1) continue
              ctx.fillStyle = colorOf(mixFeature(palette, phase + dist * 0.72), 0.95)
              var x = k * gap + (gap - barW) / 2
              var radius = Math.min(barW / 2, 4, half)
              if (typeof ctx.roundRect === 'function') {
                ctx.beginPath()
                ctx.roundRect(x, h / 2 - half, barW, half * 2, [radius, radius, radius, radius])
                ctx.fill()
              } else {
                ctx.fillRect(x, h / 2 - half, barW, half * 2)
              }
            }
            ctx.globalAlpha = 1
            if (playing) frame = requestAnimationFrame(draw)
          }
          frame = requestAnimationFrame(draw)
          return function () {
            if (frame !== 0) cancelAnimationFrame(frame)
            if (observer !== null) observer.disconnect()
            window.removeEventListener('resize', resize)
          }
        },
        [accent, playing, active],
      )
      return h('canvas', {
        ref: ref,
        className: cx('mp-np-reflect-wave', (playing !== true || active !== true) && 'is-fading'),
        'aria-hidden': 'true',
      })
    }

    function NowPlaying(props) {
      var snap = usePlayerSnapshot()
      var time = usePlayerTime()
      var prefs = usePrefs()
      var track = snap.queue[snap.index] || null
      var trackPath = track ? track.path : ''
      // Fade the incoming cover/title/artist only. Removing the outgoing node with
      // a zero-length animation keeps rapid next/previous clicks responsive; the
      // old implementation kept it on screen for the whole fade and felt blocked.
      function incomingFade(el, action) {
        if (action !== 'add') return new KeyframeEffect(el, [], { duration: 0 })
        if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          return new KeyframeEffect(el, [], { duration: 0 })
        }
        return new KeyframeEffect(
          el,
          [
            { opacity: 0.25, transform: 'scale(.985)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 170, easing: 'ease-out', fill: 'both' },
        )
      }
      var coverMotion = useAutoAnimate(incomingFade)
      var metaMotion = useAutoAnimate(incomingFade)
      var coverMotionRef = coverMotion[0]
      var metaMotionRef = metaMotion[0]
      var pair = useState([])
      var lyrics = pair[0]
      var setLyrics = pair[1]
      var loadingPair = useState(false)
      var lyricsLoading = loadingPair[0]
      var setLyricsLoading = loadingPair[1]
      var errorPair = useState('')
      var lyricError = errorPair[0]
      var setLyricError = errorPair[1]
      var settingsPair = useState(false)
      var editorPair = useState(false)
      var editorOpen = editorPair[0]
      var setEditorOpen = editorPair[1]
      var fsPair = useState(false)
      var isFullscreen = fsPair[0]
      var setIsFullscreen = fsPair[1]
      var settingsOpen = settingsPair[0]
      var setSettingsOpen = settingsPair[1]
      var settingsRef = useRef(null)
      var settingsBtnRef = useRef(null)
      var npRef = useRef(null)
      var coverImgRef = useRef(null)
      var settingsPosPair = useState(null)
      var settingsPos = settingsPosPair[0]
      var setSettingsPos = settingsPosPair[1]
      var extraPair = useState('')
      var extraPanel = extraPair[0]
      var setExtraPanel = extraPair[1]
      var sleepCustomPair = useState('')
      var sleepCustom = sleepCustomPair[0]
      var setSleepCustom = sleepCustomPair[1]
      var sleepRemaining = useCountdown(extraPanel === 'sleep' ? prefs.sleepDeadline : 0)
      var sleepRef = useRef(null)
      var audioRef = useRef(null)
      var sourcePair = useState('')
      var lyricSource = sourcePair[0]
      var setLyricSource = sourcePair[1]
      var offsetPair = useState(0)
      var offsetMs = offsetPair[0]
      var setOffsetMs = offsetPair[1]
      var reloadPair = useState(0)
      var lyricReload = reloadPair[0]
      var setLyricReload = reloadPair[1]
      var boxRef = useRef(null)
      var innerRef = useRef(null)
      var discWrapRef = useRef(null)
      var rowRefs = useRef([])

      useEffect(
        function () {
          if (!settingsOpen) return undefined
          function onDown(event) {
            var target = event.target
            if (settingsRef.current && settingsRef.current.contains(target)) return
            if (settingsBtnRef.current && settingsBtnRef.current.contains(target)) return
            setSettingsOpen(false)
          }
          function onKey(event) {
            if (event.key === 'Escape') setSettingsOpen(false)
          }
          document.addEventListener('pointerdown', onDown, true)
          window.addEventListener('keydown', onKey)
          return function () {
            document.removeEventListener('pointerdown', onDown, true)
            window.removeEventListener('keydown', onKey)
          }
        },
        [settingsOpen],
      )
      useEffect(
        function () {
          if (extraPanel === '') return undefined
          function onDown(event) {
            if (sleepRef.current && sleepRef.current.contains(event.target)) return
            if (audioRef.current && audioRef.current.contains(event.target)) return
            setExtraPanel('')
          }
          function onKey(event) {
            if (event.key === 'Escape') setExtraPanel('')
          }
          document.addEventListener('pointerdown', onDown, true)
          window.addEventListener('keydown', onKey)
          return function () {
            document.removeEventListener('pointerdown', onDown, true)
            window.removeEventListener('keydown', onKey)
          }
        },
        [extraPanel],
      )
      var cover = track ? trackCoverSrc(track) : ''
      var bgPair = useState({ current: '', previous: '' })
      var bg = bgPair[0]
      var setBg = bgPair[1]

      useEffect(
        function () {
          var cancelled = false
          if (cover === '') {
            setBg({ current: '', previous: '' })
            return undefined
          }
          createBlurredBackdrop(cover).then(function (texture) {
            if (cancelled || texture === '') return
            setBg(function (prev) {
              if (prev.current === texture) return prev
              return { current: texture, previous: prev.current }
            })
          })
          return function () {
            cancelled = true
          }
        },
        [cover],
      )

      // Cached online streams carry real codec/sample-rate/bitrate facts; probe the
      // cache after playback starts and merge them into the current queue track.
      useEffect(
        function () {
          if (!track || !track.onlineProvider || !track.onlineId) return undefined
          var provider = track.onlineProvider
          var id = track.onlineId
          var path = track.path
          var cancelled = false
          var attempts = 0
          var timer = null
          function ask() {
            if (cancelled) return
            getJson(
              API +
                'online/info?provider=' +
                encodeURIComponent(provider) +
                '&id=' +
                encodeURIComponent(id),
            )
              .then(function (body) {
                if (cancelled) return
                var info = body && body.cached ? body.info : null
                if (info && (info.codec || info.sampleRate || info.bitrate)) {
                  player.updateTrack(path, {
                    codec: info.codec || '',
                    sampleRate: Number(info.sampleRate) || 0,
                    bitrate: Number(info.bitrate) || 0,
                    size: Number(info.size) || 0,
                  })
                  return
                }
                if (attempts < 30) {
                  attempts += 1
                  timer = setTimeout(ask, 600)
                }
              })
              .catch(function () {
                if (cancelled) return
                if (attempts < 15) {
                  attempts += 1
                  timer = setTimeout(ask, 900)
                }
              })
          }
          ask()
          return function () {
            cancelled = true
            if (timer !== null) clearTimeout(timer)
          }
        },
        [trackPath, track && track.onlineProvider, track && track.onlineId],
      )
      var circular = prefs.coverStyle === 'vinyl'
      var stagedPair = useState(false)
      var staged = stagedPair[0]
      var setStaged = stagedPair[1]
      useEffect(
        function () {
          if (props.open !== true) {
            setStaged(false)
            return undefined
          }
          // Let the 320ms slide-in finish before starting the vinyl spin and the
          // wave rAF. Starting both on the same frame competes with the entrance
          // paint and makes the page feel heavier than it is.
          var timer = setTimeout(function () {
            setStaged(true)
          }, 360)
          return function () {
            clearTimeout(timer)
          }
        },
        [props.open],
      )
      var spinning = circular && snap.playing && staged
      var vinyl = circular
      var lyricSize = prefs.lyricSize || 18
      var translationSize = Math.round((lyricSize * (prefs.translationScale || 80)) / 100)
      var lyricsTimed = lyrics.length > 0 && lyrics[0].time >= 0
      var lyricOrderKey = Array.isArray(prefs.lyricOrder) ? prefs.lyricOrder.join(',') : 'embedded,lrc'

      useEffect(
        function () {
          if (props.open !== true || trackPath === '') return undefined
          var cancelled = false
          setLyrics([])
          setLyricSource('')
          setLyricError('')
          setLyricsLoading(true)
          var current = snap.queue[snap.index]
          async function load() {
            try {
              if (current.onlineProvider) {
                var body = await getJson(
                  API +
                    'online/lyric?provider=' +
                    encodeURIComponent(current.onlineProvider) +
                    '&id=' +
                    encodeURIComponent(current.onlineId || ''),
                )
                var lines = parseLrcText(body.lrc || '')
                if (body.translation) mergeLyricTranslation(lines, body.translation)
                if (!cancelled) {
                  setLyrics(lines)
                  setLyricSource('ONLINE')
                  setOffsetMs(0)
                }
                return
              }
              var order = Array.isArray(prefs.lyricOrder) ? prefs.lyricOrder.join(',') : 'embedded,lrc'
              var local = await getJson(
                API + 'lyrics?path=' + encodeURIComponent(current.path) + '&order=' + encodeURIComponent(order),
              )
              if (!cancelled) {
                setLyrics(Array.isArray(local.lines) ? local.lines : [])
                setLyricSource(String(local.source || ''))
                setOffsetMs(Number(local.offsetMs) || 0)
              }
            } catch (error) {
              if (!cancelled) setLyricError(errorText(error))
            } finally {
              if (!cancelled) setLyricsLoading(false)
            }
          }
          load()
          return function () {
            cancelled = true
          }
        },
        [props.open, trackPath, lyricReload, lyricOrderKey],
      )

      var active = lyricActiveIndex(lyrics, time.currentTime - offsetMs / 1000)
      var duration = time.duration > 0 ? time.duration : track ? track.durationSec || 0 : 0
      var favorite = track !== null && props.favoriteSet[track.path] === true

      var lyricScroll = useLyricAutoScroll(
        boxRef,
        innerRef,
        discWrapRef,
        rowRefs,
        active,
        lyrics,
        lyricsTimed,
        props.open === true,
        prefs.showTranslation === true,
        lyricSize,
        Number(prefs.lyricGap) || 6,
        prefs.translationScale || 80,
        prefs.lyricAlign || 'center',
      )
      // While the user browses with the wheel, sharpness follows the line at the
      // cover centre, not the (possibly off-screen) playing line.
      var lyricFocus = lyricScroll.manualIndex >= 0 ? lyricScroll.manualIndex : active

      function seekLine(line, index) {
        if (!line || line.time < 0) return
        // Clicking is the explicit "follow this line" gesture; wheel browsing alone
        // must not resume the auto-scroll spring.
        lyricScroll.resume(index)
        player.seek(line.time + offsetMs / 1000)
      }

      function applyOffset(delta) {
        if (!track || track.onlineProvider) return
        var next = Math.max(-60000, Math.min(60000, offsetMs + delta))
        setOffsetMs(next)
        postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: next }).catch(function (error) {
          setLyricError(errorText(error))
        })
      }

      function setSleep(minutes) {
        var value = Number(minutes) || 0
        setPrefs({
          sleepTimerMinutes: value,
          sleepDeadline: value > 0 ? Date.now() + value * 60000 : 0,
        })
        setExtraPanel('')
      }

      function toggleFullscreen() {
        var node = npRef.current
        if (node === null) return
        if (document.fullscreenElement === node) {
          void document.exitFullscreen()
          return
        }
        if (typeof node.requestFullscreen !== 'function') {
          showToast(t('page.fullscreenFailed'))
          return
        }
        try {
          var result = node.requestFullscreen()
          if (result && typeof result.catch === 'function') {
            result.catch(function () {
              showToast(t('page.fullscreenFailed'))
            })
          }
        } catch (error) {
          showToast(t('page.fullscreenFailed'))
        }
      }

      function applySleepCustom() {
        var value = Math.round(Number(sleepCustom))
        if (!Number.isFinite(value) || value < 1 || value > 720) return
        setSleep(value)
      }

      function writeLyricsBack() {
        if (!track || track.onlineProvider) return
        postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: offsetMs, write: true })
          .then(function () {
            setLyricReload(function (value) {
              return value + 1
            })
            showToast(t('page.lyricsSaved'))
          })
          .catch(function (error) {
            setLyricError(errorText(error))
          })
      }

      function openOnlineLyric() {
        if (!track || track.onlineProvider) return
        pushLayer('onlineLyric', {
          track: { path: track.path, title: trackTitleOf(track), artist: trackArtistOf(track) },
          onApply: function (lrc) {
            postJson(API + 'lyrics/save', { path: track.path, lrc: lrc })
              .then(function () {
                setLyricReload(function (value) {
                  return value + 1
                })
                showToast(t('page.lyricsSaved'))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
      }

      useEffect(
        function () {
          if (props.open !== true) setEditorOpen(false)
        },
        [props.open],
      )

      useEffect(
        function () {
          function onChange() {
            setIsFullscreen(typeof document !== 'undefined' && document.fullscreenElement === npRef.current)
          }
          onChange()
          document.addEventListener('fullscreenchange', onChange)
          return function () {
            document.removeEventListener('fullscreenchange', onChange)
            if (document.fullscreenElement === npRef.current) void document.exitFullscreen()
          }
        },
        [],
      )

      useEffect(
        function () {
          if (props.open !== true && document.fullscreenElement === npRef.current) {
            void document.exitFullscreen()
          }
        },
        [props.open],
      )

      function toggleLyricSettings() {
        if (settingsOpen) {
          setSettingsOpen(false)
          return
        }
        var np = npRef.current
        var btn = settingsBtnRef.current
        if (np !== null && btn !== null) {
          var nr = np.getBoundingClientRect()
          var br = btn.getBoundingClientRect()
          var width = Math.min(320, Math.max(240, nr.width - 24))
          var left = Math.max(12, Math.min(br.left - nr.left, nr.width - width - 12))
          var bottom = Math.max(12, nr.bottom - br.top + 10)
          setSettingsPos({ left: left, bottom: bottom, width: width })
        }
        setSettingsOpen(true)
      }

      return h(
        'div',
        {
          className: cx(
            'mp-np',
            props.open === true && 'is-open',
            prefs.lyricBlur === true && 'is-blur',
            prefs.showTranslation === true && 'is-trans',
            'mp-align-' + (prefs.lyricAlign || 'center'),
          ),
          ref: npRef,
          role: 'dialog',
          'aria-label': t('page.openPlayer'),
          'aria-hidden': props.open === true ? 'false' : 'true',
          style: {
            '--mp-lyric-size': lyricSize + 'px',
            '--mp-lyric-trans': translationSize + 'px',
            '--mp-line-gap': (Number(prefs.lyricGap) || 6) + 'px',
          },
        },
        bg.current !== '' || bg.previous !== ''
          ? h(
              'div',
              { className: 'mp-np-bg' },
              bg.previous !== ''
                ? h('img', { key: 'prev:' + bg.previous, src: bg.previous, alt: '', className: 'is-prev' })
                : null,
              bg.current !== ''
                ? h('img', { key: 'cur:' + bg.current, src: bg.current, alt: '', className: 'is-cur' })
                : null,
            )
          : null,
        h('div', { className: 'mp-np-shade' }),
        h(
          'div',
          { className: 'mp-np-head' },
          h(IconButton, { icon: 'chevronDown', size: 20, title: t('page.closePlayer'), onClick: props.onClose }),
        ),
        h(
          'div',
          { className: 'mp-np-fs' },
          h(IconButton, {
            icon: isFullscreen ? 'minimize' : 'maximize',
            size: 18,
            title: isFullscreen ? t('page.exitFullscreen') : t('page.fullscreen'),
            onClick: toggleFullscreen,
          }),
        ),
        settingsOpen
          ? h(
              'div',
              {
                className: 'mp-np-settings',
                ref: settingsRef,
                style: settingsPos
                  ? { left: settingsPos.left + 'px', bottom: settingsPos.bottom + 'px', width: settingsPos.width + 'px', right: 'auto', top: 'auto' }
                  : undefined,
              },
              h(
                'div',
                { className: 'mp-np-setting' },
                h(
                  'div',
                  { className: 'mp-np-setting-head' },
                  h('span', null, t('page.lyricSize')),
                  h('span', { className: 'mp-set-val' }, lyricSize + ' px'),
                ),
                h('input', {
                  type: 'range',
                  className: 'mp-range',
                  min: 14,
                  max: 40,
                  step: 1,
                  value: lyricSize,
                  onChange: function (event) {
                    setPrefs({ lyricSize: Number(event.target.value) })
                  },
                }),
              ),
              h(
                'div',
                { className: 'mp-np-setting' },
                h(
                  'div',
                  { className: 'mp-np-setting-head' },
                  h('span', null, t('page.lyricGap')),
                  h('span', { className: 'mp-set-val' }, (Number(prefs.lyricGap) || 6) + ' px'),
                ),
                h('input', {
                  type: 'range',
                  className: 'mp-range',
                  min: 2,
                  max: 16,
                  step: 1,
                  value: Number(prefs.lyricGap) || 6,
                  onChange: function (event) {
                    setPrefs({ lyricGap: Number(event.target.value) })
                  },
                }),
              ),
              h(
                'div',
                { className: 'mp-np-setting-head' },
                h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary,#a1a1aa)' } }, t('page.translationScale')),
                h('span', { className: 'mp-set-val' }, String(prefs.translationScale || 80) + '%'),
              ),
              h('input', {
                type: 'range',
                className: 'mp-range',
                min: 50,
                max: 100,
                step: 5,
                value: prefs.translationScale || 80,
                onChange: function (event) {
                  setPrefs({ translationScale: Number(event.target.value) })
                },
              }),
              h(
                'div',
                { className: 'mp-np-setting' },
                h('div', { className: 'mp-np-setting-head' }, h('span', null, t('settings.lyricAlign'))),
                h(
                  'div',
                  { className: 'mp-np-align-row' },
                  [
                    ['left', 'settings.alignLeft'],
                    ['center', 'settings.alignCenter'],
                    ['right', 'settings.alignRight'],
                  ].map(function (item) {
                    return h(
                      'button',
                      {
                        key: item[0],
                        type: 'button',
                        className: cx(
                          'mp-chip',
                          (prefs.lyricAlign || 'left') === item[0] && 'is-on',
                        ),
                        onClick: function () {
                          setPrefs({ lyricAlign: item[0] })
                        },
                      },
                      t(item[1]),
                    )
                  }),
                ),
              ),
              h(
                'div',
                { className: 'mp-np-setting' },
                h('div', { className: 'mp-np-setting-head' }, h('span', null, t('settings.lyricOrder'))),
                h(
                  'select',
                  {
                    value: (prefs.lyricOrder || ['embedded', 'lrc']).join(','),
                    onChange: function (event) {
                      setPrefs({ lyricOrder: event.target.value.split(',') })
                    },
                  },
                  h('option', { value: 'embedded,lrc' }, t('settings.lyricSourceEmbedded') + ' → LRC'),
                  h('option', { value: 'lrc,embedded' }, 'LRC → ' + t('settings.lyricSourceEmbedded')),
                ),
              ),
              h(
                SetRow,
                { label: t('page.lyricBlur') },
                h(Switch, {
                  value: prefs.lyricBlur === true,
                  onChange: function (value) {
                    setPrefs({ lyricBlur: value })
                  },
                }),
              ),
              h(
                SetRow,
                { label: t('page.translation') },
                h(Switch, {
                  value: prefs.showTranslation === true,
                  onChange: function (value) {
                    setPrefs({ showTranslation: value })
                  },
                }),
              ),
              track && !track.onlineProvider
                ? h(
                    'div',
                    { className: 'mp-np-setting' },
                    h(
                      'div',
                      { className: 'mp-np-setting-head' },
                      h('span', null, t('page.lyricOffset')),
                      h('span', { className: 'mp-set-val' }, (offsetMs / 1000).toFixed(1) + ' s'),
                    ),
                    h(
                      'div',
                      { className: 'mp-np-offset-actions' },
                      h(
                        Button,
                        {
                          variant: 'ghost',
                          onClick: function () {
                            applyOffset(-500)
                          },
                        },
                        '−0.5s',
                      ),
                      h(
                        Button,
                        {
                          variant: 'ghost',
                          onClick: function () {
                            applyOffset(500)
                          },
                        },
                        '+0.5s',
                      ),
                      h(Button, { onClick: writeLyricsBack }, t('page.writeLyrics')),
                    ),
                    h('div', { className: 'mp-np-setting-hint' }, t('page.lyricOffsetHint')),
                  )
                : null,
              track && !track.onlineProvider
                ? h(Button, { icon: 'search', onClick: openOnlineLyric }, t('page.onlineLyrics'))
                : null,
            )
          : null,
        h(
          'div',
          { className: 'mp-np-body' },
          h(
            'div',
            { className: 'mp-np-left' },
            h(
              'div',
              { className: 'mp-np-meta', ref: metaMotionRef },
              h(
                'div',
                { key: 'title:' + trackPath, className: 'mp-np-title' },
                track ? trackTitleOf(track) : '—',
              ),
              h(
                'div',
                { key: 'artist:' + trackPath, className: 'mp-np-artist-row' },
                h('div', { className: 'mp-np-artist' }, track ? trackArtistOf(track) : ''),
                h(IconButton, {
                  className: 'mp-np-meta-audio',
                  icon: snap.muted ? 'mute' : 'volume',
                  size: 20,
                  active: snap.muted === true,
                  title: t('page.volume'),
                  onClick: function () {
                    player.setMuted(!snap.muted)
                  },
                }),
              ),
            ),
            h(
              'div',
              { className: cx('mp-np-cover-stage', vinyl && 'is-vinyl'), ref: coverMotionRef },
              h(
                'div',
                { key: 'cover:' + trackPath, className: cx('mp-np-disc-wrap', vinyl && 'is-vinyl'), ref: discWrapRef },
              h(
                'div',
                {
                  className: cx(
                    'mp-np-disc',
                    circular ? 'is-circle' : 'is-square',
                    spinning && 'is-playing',
                    vinyl && 'is-vinyl',
                  ),
                },
                vinyl ? h('div', { className: 'mp-np-vinyl' }) : null,
                h(
                  'div',
                  { className: 'mp-np-art' },
                  cover !== ''
                    ? h('img', { src: cover, alt: '', draggable: false, ref: coverImgRef })
                    : icon('note', 96),
                ),
              ),
            ),
            ),
            h(
              'div',
              { className: 'mp-np-quality' },
              h('span', { className: 'mp-np-quality-name' }, 'AudioTrack'),
              track && track.codec ? h('span', null, track.codec) : null,
              track && track.sampleRate ? h('span', null, fmtKhz(track.sampleRate)) : null,
              track && track.bitrate ? h('span', null, fmtKbps(track.bitrate)) : null,
              track && track.qualityHint ? h('span', null, track.qualityHint) : null,
            ),
            h(
              'div',
              { className: 'mp-np-progress' },
              prefs.waveEnabled !== false
                ? h(CoverReflectWave, { cover: cover, playing: snap.playing, imageRef: coverImgRef, active: staged })
                : null,
              h(SeekBar, { fallbackDuration: track ? track.durationSec || 0 : 0 }),
            ),
            h(
              'div',
              { className: 'mp-np-times' },
              h('span', null, fmtClock(time.currentTime)),
              h('span', null, fmtClock(duration)),
            ),
            h(
              'div',
              { className: 'mp-np-transport' },
              h(IconButton, {
                icon: 'prev',
                size: 28,
                title: t('page.prev'),
                tooltip: false,
                onClick: function () {
                  player.prev()
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mp-pb-play',
                  title: snap.playing ? t('page.pause') : t('page.play'),
                  onClick: function () {
                    player.toggle()
                  },
                },
                icon(snap.playing ? 'pause' : 'play', 38),
              ),
              h(IconButton, {
                icon: 'next',
                size: 28,
                title: t('page.next'),
                tooltip: false,
                onClick: function () {
                  player.next()
                },
              }),
            ),
            h(
              'div',
              { className: 'mp-np-secondary' },
              h(
                'div',
                { className: 'mp-np-extra-item', ref: sleepRef },
                h(IconButton, {
                  icon: 'clock',
                  size: 22,
                  active: extraPanel === 'sleep',
                  title: t('settings.sleepTimer'),
                  onClick: function () {
                    setExtraPanel(extraPanel === 'sleep' ? '' : 'sleep')
                  },
                }),
                extraPanel === 'sleep'
                  ? h(
                      'div',
                      { className: 'mp-np-extra-pop is-sleep' },
                      h(
                        'div',
                        { className: 'mp-np-sleep-head' },
                        h('span', { className: 'mp-np-sleep-head-icon' }, icon('clock', 14)),
                        h(
                          'div',
                          { className: 'mp-np-sleep-title-wrap' },
                          h('div', { className: 'mp-np-sleep-title' }, t('settings.sleepTimer')),
                          h(
                            'div',
                            { className: 'mp-np-sleep-hint' },
                            sleepRemaining > 0
                              ? t('sleep.remaining', { time: fmtClock(sleepRemaining / 1000) })
                              : t('sleep.hint'),
                          ),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'mp-np-sleep-close',
                            title: t('editor.close'),
                            onClick: function () {
                              setExtraPanel('')
                            },
                          },
                          icon('x', 14),
                        ),
                      ),
                      h('div', { className: 'mp-np-sleep-label' }, t('sleep.presets')),
                      h(
                        'div',
                        { className: 'mp-np-sleep-grid' },
                        [15, 30, 45, 60, 90].map(function (minutes) {
                          var on = sleepRemaining > 0 && prefs.sleepTimerMinutes === minutes
                          return h(
                            'button',
                            {
                              key: minutes,
                              type: 'button',
                              className: cx('mp-np-sleep-chip', on && 'is-on'),
                              onClick: function () {
                                setSleep(minutes)
                              },
                            },
                            minutes,
                            h('span', null, t('sleep.minutes')),
                          )
                        }),
                      ),
                      h('div', { className: 'mp-np-sleep-label' }, t('sleep.custom')),
                      h(
                        'div',
                        { className: 'mp-np-sleep-custom' },
                        h('input', {
                          type: 'text',
                          inputMode: 'numeric',
                          maxLength: 3,
                          className: 'mp-np-sleep-input',
                          placeholder: t('sleep.placeholder'),
                          'aria-label': t('sleep.placeholder'),
                          value: sleepCustom,
                          onChange: function (event) {
                            setSleepCustom(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                          },
                          onKeyDown: function (event) {
                            if (event.key === 'Enter') applySleepCustom()
                          },
                        }),
                        h('span', { className: 'mp-np-sleep-unit' }, t('sleep.minutes')),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'mp-np-sleep-set',
                            disabled: !(Number(sleepCustom) >= 1 && Number(sleepCustom) <= 720),
                            onClick: applySleepCustom,
                          },
                          t('sleep.set'),
                        ),
                      ),
                      sleepCustom !== '' && !(Number(sleepCustom) >= 1 && Number(sleepCustom) <= 720)
                        ? h('div', { className: 'mp-np-sleep-error' }, t('sleep.invalid'))
                        : null,
                      sleepRemaining > 0
                        ? h(
                            'button',
                            {
                              type: 'button',
                              className: 'mp-np-sleep-off',
                              onClick: function () {
                                setSleep(0)
                              },
                            },
                            t('settings.sleepOff'),
                          )
                        : null,
                    )
                  : null,
              ),
              h(IconButton, {
                icon: playModeIcon(playModeOf(snap)),
                size: 22,
                title: t('page.loopAll'),
                onClick: function () {
                  cyclePlayMode(snap)
                },
              }),
              h(
                'div',
                { className: 'mp-np-extra-item', ref: audioRef },
                h(IconButton, {
                  icon: 'equalizer',
                  size: 22,
                  active: extraPanel === 'audio' || extraPanel === 'eq',
                  title: t('page.audioEffects'),
                  onClick: function () {
                    var effectsOpen =
                      extraPanel === 'audio' || extraPanel === 'eq'
                    setExtraPanel(effectsOpen ? '' : 'audio')
                  },
                }),
                extraPanel === 'audio' || extraPanel === 'eq'
                  ? h(AudioEffectsPanel, {
                      view: extraPanel,
                      onView: setExtraPanel,
                      snap: snap,
                      prefs: prefs,
                      track: track,
                    })
                  : null,
              ),
              h(
                'div',
                { className: 'mp-pb-queue-wrap' },
                h(IconButton, {
                  icon: 'playlist',
                  size: 22,
                  active: props.queueOpen,
                  title: t('page.queue'),
                  onClick: props.onToggleQueue,
                }),
                props.queueOpen
                  ? h(QueuePopover, {
                      open: true,
                      anchored: true,
                      snap: snap,
                      onClose: props.onToggleQueue,
                    })
                  : null,
              ),
              h(IconButton, {
                icon: 'more',
                size: 22,
                title: t('editor.title'),
                onClick: function () {
                  setSettingsOpen(false)
                  setEditorOpen(true)
                },
              }),
            ),
          ),
          h(
            'div',
            { className: 'mp-np-right' },
            h(
              'div',
              { className: 'mp-np-lyrics' + (lyricsTimed ? '' : ' is-static'), ref: boxRef },
              lyrics.length === 0
                ? null
                : h(
                    'div',
                    { className: 'mp-np-lyrics-inner', ref: innerRef },
                    lyrics.map(function (line, index) {
                      return h(
                        'div',
                        {
                          key: String(index),
                          ref: function (element) {
                            rowRefs.current[index] = element
                          },
                          className:
                            'mp-np-line' +
                            (index === active ? ' is-active' : '') +
                            (index === lyricFocus ? ' is-focus' : '') +
                            (active >= 0 && index < active ? ' is-past' : ''),
                          style: {
                            '--mp-line-stagger': String(
                              lyricFocus >= 0 ? Math.min(Math.abs(index - lyricFocus), 8) : 0,
                            ),
                            '--mp-trans': line.translation ? '1' : '0',
                          },
                          onClick: function () {
                            seekLine(line, index)
                          },
                        },
                        h(
                          'div',
                          { className: 'mp-np-line-text' },
                          line.text,
                          lyricScroll.manualIndex === index && index === active && line.time >= 0
                            ? h('span', { className: 'mp-np-line-time' }, fmtClock(line.time))
                            : null,
                        ),
                        h(
                          'div',
                          {
                            className: 'mp-np-line-trans',
                            'aria-hidden':
                              prefs.showTranslation === true && line.translation ? 'false' : 'true',
                          },
                          h(
                            'span',
                            { className: 'mp-np-line-trans-inner' },
                            line.translation
                              ? line.translation.split('\n').map(function (part, partIndex) {
                                  return h(
                                    'span',
                                    { key: 'translation-' + partIndex, className: 'mp-np-line-trans-text' },
                                    part,
                                  )
                                })
                              : null,
                          ),
                        ),
                      )
                    }),
                  ),
            ),
            lyrics.length === 0 && lyricsLoading !== true
              ? h(
                  'div',
                  { className: 'mp-np-lyrics-empty', 'aria-live': 'polite' },
                  h('div', { className: 'mp-np-lyrics-empty-icon' }, icon('lyrics', 34)),
                  h(
                    'div',
                    { className: 'mp-np-lyrics-empty-text' },
                    lyricError !== '' ? lyricError : t('page.noLyrics'),
                  ),
                )
              : null,
            h(
              'div',
              { className: 'mp-np-lyric-foot' },
              h(
                'span',
                { className: 'mp-np-lyric-tag' },
                h(
                  'button',
                  {
                    type: 'button',
                    ref: settingsBtnRef,
                    className: cx('mp-np-lyric-tag-badge', 'is-btn', settingsOpen && 'is-on'),
                    title: t('v2.lyricSettings'),
                    'aria-label': t('v2.lyricSettings'),
                    onClick: toggleLyricSettings,
                  },
                  '词',
                ),
                lyricSource !== '' ? h('span', { className: 'mp-np-lyric-source' }, lyricSource.toUpperCase()) : null,
              ),
              h(
                'div',
                { className: 'mp-np-foot-right' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: cx('mp-np-foot-btn', 'is-boxed', prefs.showTranslation === true && 'is-on'),
                    title: t('page.translation'),
                    onClick: function () {
                      setPrefs({ showTranslation: prefs.showTranslation !== true })
                    },
                  },
                  '译',
                ),
              ),
            ),
          ),
        ),
        editorOpen
          ? h(NpEditor, {
              open: true,
              cover: cover,
              onClose: function () {
                setEditorOpen(false)
              },
            })
          : null,

      )
    }

    // ── src/ui/05-queue.js
    /**
     * queue: side panel inside the workspace, plus the floating variant used from
     * the chat composer. Both share QueueList so there is one row implementation.
     */

    var QUEUE_BANDS = [0, 3, 8, 20, 48]

    function QueueWave(props) {
      var pair = useState([0.16, 0.28, 0.2, 0.12])
      var levels = pair[0]
      var setLevels = pair[1]
      useEffect(
        function () {
          if (props.playing !== true) return undefined
          var frame = 0
          var last = 0
          function tick(now) {
            frame = requestAnimationFrame(tick)
            if (now - last < 70) return
            last = now
            var data = player.getWave()
            if (data === null || data.length === 0) return
            var next = []
            for (var band = 0; band < QUEUE_BANDS.length - 1; band += 1) {
              var start = QUEUE_BANDS[band]
              var end = Math.min(QUEUE_BANDS[band + 1], data.length)
              var sum = 0
              for (var i = start; i < end; i += 1) sum += data[i]
              var avg = end > start ? sum / (end - start) : 0
              var normalized = Math.max(0, Math.min(1, (avg - 4) / 240))
              next.push(0.08 + Math.pow(normalized, 1.3) * 0.92)
            }
            setLevels(next)
          }
          frame = requestAnimationFrame(tick)
          return function () {
            cancelAnimationFrame(frame)
          }
        },
        [props.playing],
      )
      return h(
        'span',
        { className: 'mp-q-wave', 'aria-hidden': 'true' },
        levels.map(function (level, index) {
          return h('i', {
            key: index,
            style: { height: Math.round(3 + level * 11) + 'px' },
          })
        }),
      )
    }

    function QueueList(props) {
      var snap = props.snap
      var listRef = useRef(null)
      var dragFromRef = useRef(null)
      useEffect(
        function () {
          var box = listRef.current
          if (!box || box.clientHeight === 0) return
          var row = box.querySelector('.mp-q-row.is-cur')
          if (!row) return
          // Only move the list when the active row is outside the viewport. The
          // queue used to centre it on every play/pause, which made clicking a
          // visible row jump the entire list.
          var rowRect = row.getBoundingClientRect()
          var boxRect = box.getBoundingClientRect()
          if (rowRect.top < boxRect.top + 4) {
            box.scrollTop -= boxRect.top - rowRect.top + 8
          } else if (rowRect.bottom > boxRect.bottom - 4) {
            box.scrollTop += rowRect.bottom - boxRect.bottom + 8
          }
        },
        [snap && snap.queue, snap && snap.index, snap && snap.order],
      )
      if (!snap || !snap.queue || snap.queue.length === 0) {
        return h(
          'div',
          { className: 'mp-empty', style: { padding: '36px 16px' } },
          icon('list', 24),
          h('strong', null, t('page.queueEmpty')),
        )
      }
      var order = snap.order === 'random' ? player.getPlayOrder() : snap.queue.map(function (_, index) { return index })
      if (!Array.isArray(order) || order.length !== snap.queue.length) {
        order = snap.queue.map(function (_, index) { return index })
      }
      return h(
        'div',
        { className: 'mp-q-list', ref: listRef },
        order.map(function (queueIndex, position) {
          var track = snap.queue[queueIndex]
          if (!track) return null
          var current = queueIndex === snap.index
          return h(
            'div',
            {
              key: track.path + ':' + queueIndex,
              className: cx('mp-q-row', current && 'is-cur'),
              draggable: true,
              onDragStart: function (event) {
                dragFromRef.current = position
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', String(position))
                }
              },
              onDragOver: function (event) {
                if (dragFromRef.current === null) return
                event.preventDefault()
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
              },
              onDrop: function (event) {
                event.preventDefault()
                var from = dragFromRef.current
                dragFromRef.current = null
                if (from === null || from === position) return
                var indices = order.slice()
                var moved = indices.splice(from, 1)[0]
                indices.splice(position, 0, moved)
                player.reorderQueue(indices)
              },
              onDragEnd: function () {
                dragFromRef.current = null
              },
              onClick: function () {
                if (dragFromRef.current === null) player.select(snap.queue, queueIndex)
              },
              title: trackTitleOf(track),
            },
            h(
              'div',
              { className: 'mp-q-idx' },
              current
                ? snap.playing
                  ? h(QueueWave, { playing: true })
                  : icon('play', 12)
                : String(position + 1),
            ),
            h('div', { className: 'mp-q-cover' }, h(Cover, { src: trackCoverSrc(track), iconSize: 14 })),
            h(
              'div',
              { className: 'mp-q-main' },
              h('div', { className: 'mp-q-name' }, trackTitleOf(track)),
              h('div', { className: 'mp-q-artist' }, trackArtistOf(track)),
            ),
            h('div', { className: 'mp-q-artist' }, fmtTime(track.durationSec)),
          )
        }),
      )
    }

    function QueuePanel(props) {
      return h(
        'aside',
        { className: 'mp-queue', 'aria-label': t('page.queue') },
        h(
          'div',
          { className: 'mp-q-head' },
          h(
            'div',
            null,
            h('div', { className: 'mp-q-title' }, t('page.queue')),
            h(
              'div',
              { className: 'mp-q-sub' },
              (props.snap.queue.length || 0) + ' · ' + (props.snap.order === 'random' ? t('page.shuffle') : t('page.modeSequence')),
            ),
          ),
          h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
          h(IconButton, {
            icon: 'target',
            size: 15,
            title: t('page.locateCurrent'),
            onClick: props.onLocate,
          }),
          h(IconButton, {
            icon: 'x',
            size: 15,
            title: t('v2.close'),
            onClick: props.onClose,
          }),
        ),
        h(QueueList, { snap: props.snap }),
      )
    }

    function QueuePopover(props) {
      useEffect(
        function () {
          if (props.open !== true) return undefined
          function onDown(event) {
            var target = event.target
            if (target && target.closest) {
              if (target.closest('.mp-queue-pop')) return
              if (target.closest('.mp-pb-queue-wrap')) return
              if (target.closest('.mp-composer-cluster')) return
            }
            props.onClose()
          }
          document.addEventListener('pointerdown', onDown, true)
          return function () {
            document.removeEventListener('pointerdown', onDown, true)
          }
        },
        [props.open, props.onClose],
      )
      if (props.open !== true) return null
      return h(
        'div',
        {
          className: cx('mp-queue-pop', props.anchored === true && 'is-anchored'),
          role: 'dialog',
          'aria-label': t('page.queue'),
          style: props.style,
        },
        h(
          'div',
          { className: 'mp-q-head' },
          h('div', { className: 'mp-q-title' }, t('page.queue')),
          h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
          h(IconButton, { icon: 'x', size: 14, title: t('v2.close'), onClick: props.onClose }),
        ),
        h(QueueList, { snap: props.snap }),
      )
    }

    // ── src/ui/06-settings.js
    /**
     * settings: one full-height sheet with six tabs.
     *
     * The layout switch lives here (Appearance → Layout) because the user asked for
     * a single, discoverable place to change it.
     */

    var SETTINGS_TABS = [
      { key: 'appearance', label: 'v2.appearance' },
      { key: 'lyrics', label: 'v2.lyrics' },
      { key: 'playback', label: 'v2.playback' },
      { key: 'online', label: 'v2.online' },
      { key: 'library', label: 'v2.library' },
      { key: 'cache', label: 'v2.cacheTab' },
      { key: 'about', label: 'v2.about' },
    ]

    function SettingsSheet(props) {
      var prefs = usePrefs()
      var sleepRemaining = useCountdown(prefs.sleepDeadline)
      var library = useStore(libraryStore)
      var online = useStore(onlineStore)
      var tabPair = useState('appearance')
      var tab = tabPair[0]
      var setTab = tabPair[1]
      var cachePair = useState(null)
      var cacheSongsPair = useState(null)
      var cacheSongs = cacheSongsPair[0]
      var setCacheSongs = cacheSongsPair[1]
      var builtinLoudness =
        typeof window !== 'undefined' &&
        (typeof window.OfflineAudioContext !== 'undefined' ||
          typeof window.webkitOfflineAudioContext !== 'undefined')
      var cache = cachePair[0]
      var setCache = cachePair[1]
      var pathPair = useState('')
      var rootDraft = pathPair[0]
      var setRootDraft = pathPair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      // Navidrome credential form. Every hook in this component must run on each
      // render, so it lives here rather than inside the tab/card render helpers.
      var navForm = useNavidromeForm()

      useEffect(
        function () {
          if (tab !== 'online' || props.open !== true) return undefined
          void loadProviders()
          return undefined
        },
        [tab, props.open],
      )

      useEffect(
        function () {
          if (tab !== 'cache' || props.open !== true) return undefined
          var cancelled = false
          getJson(API + 'online/cache')
            .then(function (body) {
              if (!cancelled) setCache(body)
            })
            .catch(function () {
              if (!cancelled) setCache(null)
            })
          getJson(API + 'online/cache/list')
            .then(function (body) {
              if (!cancelled) setCacheSongs(Array.isArray(body.songs) ? body.songs : [])
            })
            .catch(function () {
              if (!cancelled) setCacheSongs([])
            })
          return function () {
            cancelled = true
          }
        },
        [tab, props.open],
      )

      if (props.open !== true) return null

      function patchPrefs(patch) {
        setPrefs(patch)
      }

      function layoutChoices() {
        return h(
          'div',
          { className: 'mp-set-choice-row' },
          h(
            'button',
            {
              type: 'button',
              className: cx('mp-chip', prefs.layout === 'top' && 'is-on'),
              onClick: function () {
                patchPrefs({ layout: 'top' })
              },
            },
            icon('list', 13),
            t('v2.layoutTop'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: cx('mp-chip', prefs.layout === 'rail' && 'is-on'),
              onClick: function () {
                patchPrefs({ layout: 'rail' })
              },
            },
            icon('list', 13),
            t('v2.layoutRail'),
          ),
        )
      }

      function appearanceTab() {
        return [
          h('h2', { key: 'h' }, t('v2.appearance')),
          h(
            SetRow,
            { key: 'layout', label: t('v2.layout'), desc: t('v2.layoutHint') },
            layoutChoices(),
          ),
          h(
            SetRow,
            { key: 'coverStyle', label: t('v2.coverStyle'), desc: t('v2.coverStyleDesc') },
            h(
              'div',
              { className: 'mp-set-choice-row' },
              h(
                'button',
                {
                  type: 'button',
                  className: cx('mp-chip', prefs.coverStyle !== 'vinyl' && 'is-on'),
                  onClick: function () {
                    patchPrefs({ coverStyle: 'square', circularCover: false, vinylRing: false, coverSpin: false })
                  },
                },
                t('v2.coverSquare'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: cx('mp-chip', prefs.coverStyle === 'vinyl' && 'is-on'),
                  onClick: function () {
                    patchPrefs({ coverStyle: 'vinyl', circularCover: true, vinylRing: true, coverSpin: true })
                  },
                },
                t('v2.coverVinyl'),
              ),
            ),
          ),
          h(
            SetRow,
            { key: 'hostkit', label: t('v2.hostKit'), desc: t('v2.hostKitDesc') },
            h(
              'span',
              { className: 'mp-chip', style: { cursor: 'default' } },
              hostUi ? t('v2.hostKitNative') : t('v2.hostKitFallback'),
            ),
          ),
        ]
      }

      function lyricsTab() {
        return [
          h('h2', { key: 'h' }, t('v2.lyrics')),
          h(
            SetRow,
            { key: 'tr', label: t('page.translation') },
            h(Switch, {
              value: prefs.showTranslation === true,
              onChange: function (value) {
                patchPrefs({ showTranslation: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'composer-lyrics', label: t('settings.composerLyrics') },
            h(Switch, {
              value: prefs.composerLyrics === true,
              onChange: function (value) {
                patchPrefs({ composerLyrics: value })
              },
            }),
          ),
          h(
            SetRow,
            {
              key: 'composer-translation',
              label: t('settings.composerTranslation'),
              desc: t('settings.composerTranslationDesc'),
            },
            h(Switch, {
              value: prefs.composerTranslation !== false,
              onChange: function (value) {
                patchPrefs({ composerTranslation: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'size', label: t('page.lyricSize') },
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 14,
              max: 40,
              step: 1,
              value: prefs.lyricSize,
              onChange: function (event) {
                patchPrefs({ lyricSize: Number(event.target.value) })
              },
            }),
            h('span', { className: 'mp-set-val' }, String(prefs.lyricSize) + ' px'),
          ),
          h(
            SetRow,
            { key: 'gap', label: t('page.lyricGap') },
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 2,
              max: 16,
              step: 1,
              value: Number(prefs.lyricGap) || 6,
              onChange: function (event) {
                patchPrefs({ lyricGap: Number(event.target.value) })
              },
            }),
            h('span', { className: 'mp-set-val' }, (Number(prefs.lyricGap) || 6) + ' px'),
          ),
          h(
            SetRow,
            { key: 'scale', label: t('page.translationScale') },
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 60,
              max: 100,
              step: 5,
              value: prefs.translationScale,
              onChange: function (event) {
                patchPrefs({ translationScale: Number(event.target.value) })
              },
            }),
            h('span', { className: 'mp-set-val' }, String(prefs.translationScale) + '%'),
          ),
          h(
            SetRow,
            { key: 'order', label: t('settings.lyricOrder') },
            h(
              'select',
              {
                value: (prefs.lyricOrder || []).join(','),
                onChange: function (event) {
                  patchPrefs({ lyricOrder: event.target.value.split(',') })
                },
              },
              h('option', { value: 'embedded,lrc' }, t('settings.lyricSourceEmbedded') + ' → LRC'),
              h('option', { value: 'lrc,embedded' }, 'LRC → ' + t('settings.lyricSourceEmbedded')),
            ),
          ),
          h(
            SetRow,
            { key: 'blur', label: t('page.lyricBlur') },
            h(Switch, {
              value: prefs.lyricBlur === true,
              onChange: function (value) {
                patchPrefs({ lyricBlur: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'align', label: t('settings.lyricAlign') },
            h(
              'select',
              {
                value: prefs.lyricAlign || 'center',
                onChange: function (event) {
                  patchPrefs({ lyricAlign: event.target.value })
                },
              },
              h('option', { value: 'center' }, t('settings.alignCenter')),
              h('option', { value: 'left' }, t('settings.alignLeft')),
              h('option', { value: 'right' }, t('settings.alignRight')),
            ),
          ),
        ]
      }

      function playbackTab() {
        return [
          h('h2', { key: 'h' }, t('v2.playback')),
          h(
            SetRow,
            { key: 'resume', label: t('settings.resumeOnStart') },
            h(Switch, {
              value: prefs.resumeOnStart === true,
              onChange: function (value) {
                patchPrefs({ resumeOnStart: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'auto', label: t('settings.autoResume') },
            h(Switch, {
              value: prefs.autoResume === true,
              onChange: function (value) {
                patchPrefs({ autoResume: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'per', label: t('settings.rememberPerTrack') },
            h(Switch, {
              value: prefs.rememberPerTrack === true,
              onChange: function (value) {
                patchPrefs({ rememberPerTrack: value })
              },
            }),
          ),
          h(
            SetRow,
            {
              key: 'normalize',
              label: t('settings.volumeNormalize'),
              desc: t('settings.volumeNormalizeHint'),
            },
            h(Switch, {
              value: prefs.normalizeVolume !== false,
              onChange: function (value) {
                patchPrefs({ normalizeVolume: value })
                if (player.setNormalize) player.setNormalize(value)
              },
            }),
          ),
          h(
            'div',
            {
              key: 'normalize-status',
              className: cx(
                'mp-set-status',
                prefs.normalizeVolume === false ? 'is-off' : builtinLoudness ? 'is-on' : 'is-bad',
              ),
            },
            h('i'),
            h(
              'span',
              null,
              prefs.normalizeVolume === false
                ? t('settings.volumeNormalizeOff')
                : builtinLoudness
                  ? t('settings.volumeNormalizeReady')
                  : t('settings.volumeNormalizeMissing'),
            ),
            prefs.normalizeVolume !== false && !builtinLoudness
              ? h('span', { className: 'mp-set-status-hint' }, t('settings.volumeNormalizeMissingHint'))
              : null,
          ),
          h(
            SetRow,
            {
              key: 'crossfade',
              label: t('settings.crossfade'),
              desc: t('settings.crossfadeHint'),
            },
            h(Switch, {
              value: crossfadeFadeSeconds(prefs) > 0,
              onChange: function (value) {
                patchPrefs({ crossfadeSeconds: value ? CROSSFADE_MAX_SECONDS : 0 })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'sleep', label: t('settings.sleepTimer') },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              h(
                'select',
                {
                  value: String(prefs.sleepTimerMinutes || 0),
                  onChange: function (event) {
                    var minutes = Number(event.target.value) || 0
                    patchPrefs({
                      sleepTimerMinutes: minutes,
                      sleepDeadline: minutes > 0 ? Date.now() + minutes * 60000 : 0,
                    })
                  },
                },
                [0, 15, 30, 60, 90].map(function (minutes) {
                  return h(
                    'option',
                    { key: minutes, value: String(minutes) },
                    minutes === 0 ? t('settings.sleepOff') : t('v2.minutes', { n: minutes }),
                  )
                }),
              ),
              sleepRemaining > 0
                ? h('span', { className: 'mp-set-val' }, t('v2.sleepRemaining', { time: fmtClock(sleepRemaining / 1000) }))
                : null,
              sleepRemaining > 0
                ? h(
                    Button,
                    {
                      variant: 'ghost',
                      onClick: function () {
                        patchPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
                      },
                    },
                    t('v2.sleepCancel'),
                  )
                : null,
            ),
          ),
        ]
      }

      function accountAvatar(info) {
        if (info.avatarUrl) {
          return h('img', {
            className: 'mp-account-avatar',
            src: API + 'online/cover?url=' + encodeURIComponent(info.avatarUrl),
            alt: '',
          })
        }
        return h('span', { className: 'mp-account-avatar is-fallback' }, (info.nickname || '?').slice(0, 1))
      }

      function onlineTab() {
        var providers = online.providers || {}
        var ids = ['netease', 'qq', 'kugou', 'kugouLite', 'navidrome']
        var logged = ids.filter(function (provider) {
          return providers[provider] && providers[provider].loggedIn === true
        }).length
        function providerLabel(provider) {
          if (provider === 'navidrome') return t('online.providerNavidrome')
          return provider === 'netease'
            ? t('online.providerNetease')
            : provider === 'qq'
              ? t('online.providerQq')
              : provider === 'kugou'
                ? t('online.providerKugou')
                : t('online.providerKugouLite')
        }
        /**
         * Navidrome / Subsonic: a URL + credential form instead of a QR flow.
         * The password only travels once, to be traded for a salted token.
         */
        function navidromeCard(info, form) {
          var busy = form.phase === 'loading'
          return h(
            'div',
            { key: 'navidrome', className: cx('mp-online-card', 'is-navidrome', info.loggedIn === true && 'is-logged') },
            h(
              'div',
              { className: 'mp-online-card-head' },
              // Official logo, verbatim and unmodified (navidrome.org/brand allows
              // it for a server-connection screen). Sized to match the other
              // provider logos rather than above them, as the guidelines require.
              h('span', { className: 'mp-online-logo', title: 'Navidrome' }, providerLogo('navidrome', 38)),
              h(
                'div',
                { className: 'mp-online-title' },
                h('div', { className: 'mp-online-name' }, t('online.providerNavidrome')),
                h(
                  'div',
                  { className: 'mp-online-state' },
                  info.loggedIn === true ? t('online.loggedIn') : t('online.loggedOut'),
                ),
              ),
            ),
            info.loggedIn === true
              ? h(
                  'div',
                  { className: 'mp-online-body' },
                  h(
                    'div',
                    { className: 'mp-online-meta' },
                    h('strong', { className: 'mp-online-nick' }, info.nickname || info.username || t('online.loggedIn')),
                    info.server ? h('span', { className: 'mp-online-hint-text' }, info.server) : null,
                  ),
                  h(IconButton, {
                    icon: 'logout',
                    size: 15,
                    title: t('online.logout'),
                    onClick: function () {
                      form.reset()
                      void logoutProvider('navidrome')
                    },
                  }),
                )
              : h(
                  'div',
                  { className: 'mp-online-body is-out mp-navidrome-body' },
                  h('span', { className: 'mp-online-hint-text' }, t('online.navidromeHint')),
                  h('input', {
                    className: 'mp-kit-input',
                    type: 'url',
                    placeholder: t('online.navidromeServerPlaceholder'),
                    value: form.server,
                    disabled: busy,
                    onChange: function (event) {
                      form.setServer(event.target.value)
                    },
                  }),
                  h('input', {
                    className: 'mp-kit-input',
                    type: 'text',
                    placeholder: t('online.navidromeUser'),
                    value: form.username,
                    disabled: busy,
                    onChange: function (event) {
                      form.setUsername(event.target.value)
                    },
                  }),
                  h('input', {
                    className: 'mp-kit-input',
                    type: 'password',
                    placeholder: t('online.navidromePassword'),
                    value: form.password,
                    disabled: busy,
                    onChange: function (event) {
                      form.setPassword(event.target.value)
                    },
                  }),
                  form.error !== ''
                    ? h('span', { className: 'mp-online-error' }, form.error)
                    : form.notice !== ''
                      ? h('span', { className: 'mp-online-ok' }, form.notice)
                      : null,
                  h(Button, {
                    variant: 'primary',
                    icon: 'checkCircle',
                    disabled: busy,
                    onClick: function () {
                      void form.connect()
                    },
                    children: busy ? t('online.navidromeConnecting') : t('online.navidromeConnect'),
                  }),
                ),
          )
        }

        function card(provider) {
          var info = providers[provider] || {}
          // Navidrome signs in with credentials, not a QR code, so it gets its own
          // body instead of the shared "scan to sign in" branch below.
          if (provider === 'navidrome') return navidromeCard(info, navForm)
          return h(
            'div',
            { key: provider, className: cx('mp-online-card', 'is-' + provider, info.loggedIn === true && 'is-logged') },
            h(
              'div',
              { className: 'mp-online-card-head' },
              h('span', { className: 'mp-online-logo' }, providerLogo(provider, 38)),
              h(
                'div',
                { className: 'mp-online-title' },
                h('div', { className: 'mp-online-name' }, providerLabel(provider)),
                h(
                  'div',
                  { className: 'mp-online-state' },
                  info.loggedIn === true ? t('online.loggedIn') : t('online.loggedOut'),
                ),
              ),
            ),
            info.loggedIn
              ? h(
                  'div',
                  { className: 'mp-online-body' },
                  accountAvatar(info),
                  h(
                    'div',
                    { className: 'mp-online-meta' },
                    h('strong', { className: 'mp-online-nick' }, info.nickname || (provider === 'qq' ? t('online.qqAccount') : t('online.loggedIn'))),
                    info.accountId ? h('span', { className: 'mp-online-id' }, 'ID ' + info.accountId) : null,
                    info.vip === true ? h('span', { className: 'mp-online-vip' }, 'VIP') : null,
                  ),
                  h(IconButton, {
                    icon: 'logout',
                    size: 15,
                    title: t('online.logout'),
                    onClick: function () {
                      void logoutProvider(provider)
                    },
                  }),
                )
              : h(
                  'div',
                  { className: 'mp-online-body is-out' },
                  h('span', { className: 'mp-online-hint-text' }, t('online.accountHint')),
                  h(Button, {
                    variant: 'primary',
                    icon: 'qr',
                    onClick: function () {
                      pushLayer('login', { provider: provider })
                    },
                    children: t('online.login'),
                  }),
                ),
          )
        }
        return [
          h(
            'div',
            { key: 'head', className: 'mp-online-head' },
            h('h2', null, t('v2.online')),
            h('span', { className: 'mp-online-count' }, t('online.loggedCount', { n: logged, total: ids.length })),
          ),
          h('div', { key: 'grid', className: 'mp-online-grid' }, ids.map(card)),
          h(
            'div',
            { key: 'hint', className: 'mp-online-foot' },
            icon('info', 13),
            h('span', null, t('online.settingsHint')),
          ),
        ]
      }

      function libraryTab() {
        var config = library.config || { roots: [], hiddenRoots: [], depth: 4 }
        var roots = Array.isArray(config.roots) ? config.roots : []
        var hiddenRoots = Array.isArray(config.hiddenRoots) ? config.hiddenRoots : []
        var scanning = library.phase === 'loading'
        function setRootVisible(root, visible) {
          var next = hiddenRoots.slice()
          var at = next.indexOf(root)
          if (visible && at >= 0) next.splice(at, 1)
          if (!visible && at < 0) next.push(root)
          void saveConfig({ hiddenRoots: next })
        }
        function removeRoot(root) {
          pushLayer('confirm', {
            title: t('page.delete'),
            text: t('settings.removeConfirm'),
            onConfirm: function () {
              var next = roots.filter(function (item) {
                return item !== root
              })
              void saveConfig({ roots: next })
            },
          })
        }
        function rescan() {
          if (scanning) return
          void loadLibrary(true)
          showToast(t('page.scanning'))
        }
        var folderRows =
          roots.length === 0
            ? [h('div', { key: 'empty', className: 'mp-set-empty-card' }, t('v2.noTracksHint'))]
            : roots.map(function (root) {
                var hidden = hiddenRoots.indexOf(root) >= 0
                return h(
                  'div',
                  { key: root, className: cx('mp-root-row', hidden && 'is-hidden') },
                  h('span', { className: 'mp-root-icon' }, icon('folder', 16)),
                  h(
                    'div',
                    { className: 'mp-root-main' },
                    h('div', { className: 'mp-root-path', title: root }, root),
                    h('div', { className: 'mp-root-state' }, hidden ? t('v2.folderHidden') : t('v2.folderVisible')),
                  ),
                  h(
                    'div',
                    { className: 'mp-root-actions' },
                    h(Switch, {
                      value: !hidden,
                      label: hidden ? t('v2.folderHidden') : t('v2.folderVisible'),
                      onChange: function (visible) {
                        setRootVisible(root, visible)
                      },
                    }),
                    h(IconButton, {
                      icon: 'trash',
                      size: 15,
                      title: t('page.delete'),
                      onClick: function () {
                        removeRoot(root)
                      },
                    }),
                  ),
                )
              })
        return [
          h(
            'div',
            { key: 'head', className: 'mp-set-page-head' },
            h('h2', null, t('v2.library')),
            h(
              'span',
              { className: 'mp-set-page-meta' },
              t('settings.scannedTracks', { n: (library.tracks || []).length }),
              (library.warnings || []).length > 0
                ? ' · ' + t('settings.scanWarnings', { n: library.warnings.length })
                : '',
              library.truncated === true ? ' · ' + t('page.truncated') : '',
            ),
          ),
          h(
            'section',
            { key: 'folders', className: 'mp-set-card' },
            h(
              'div',
              { className: 'mp-set-card-head' },
              h('div', { className: 'mp-set-card-title' }, icon('folder', 13), t('settings.foldersTitle')),
              h(Button, {
                variant: 'ghost',
                icon: 'refresh',
                disabled: scanning,
                onClick: rescan,
                children: scanning ? t('page.scanning') : t('page.refresh'),
              }),
            ),
            h('div', { className: 'mp-set-card-body' }, folderRows),
            h(
              'div',
              { className: 'mp-root-add' },
              h('input', {
                type: 'text',
                className: 'mp-kit-input',
                value: rootDraft,
                placeholder: 'D:\\Music',
                onChange: function (event) {
                  setRootDraft(event.target.value)
                },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') addRoot()
                },
              }),
              h(
                Button,
                { variant: 'ghost', icon: 'folder', onClick: function () { pushLayer('folderPicker') } },
                t('v2.folderBrowse'),
              ),
              h(Button, {
                variant: 'primary',
                icon: 'plus',
                disabled: busy || rootDraft.trim() === '',
                onClick: addRoot,
                children: t('page.create'),
              }),
            ),
          ),
          h(
            'section',
            { key: 'scan', className: 'mp-set-card' },
            h(
              'div',
              { className: 'mp-set-card-head' },
              h('div', { className: 'mp-set-card-title' }, icon('settings', 13), t('settings.scanSettings')),
            ),
            h(
              'div',
              { className: 'mp-set-card-body' },
              h(
                SetRow,
                { key: 'depth', label: t('settings.depth'), desc: t('settings.depthHint') },
                h(
                  'select',
                  {
                    value: String(config.depth === undefined ? 4 : config.depth),
                    onChange: function (event) {
                      void saveConfig({ depth: Number(event.target.value) })
                    },
                  },
                  [0, 1, 2, 3, 4, 5, 6].map(function (n) {
                    return h('option', { key: n, value: String(n) }, String(n))
                  }),
                ),
              ),
              h('div', { className: 'mp-set-hint-line' }, t('settings.formatsHint')),
            ),
          ),
          h(
            'section',
            { key: 'trash', className: 'mp-set-card' },
            h(
              'div',
              { className: 'mp-set-card-head' },
              h('div', { className: 'mp-set-card-title' }, icon('trash', 13), t('v2.trash')),
              h(Button, { variant: 'ghost', icon: 'trash', onClick: function () { pushLayer('trash', {}) } }, t('settings.openTrash')),
            ),
            h('div', { className: 'mp-set-card-body' }, h('p', { className: 'mp-set-desc' }, t('v2.trashHint'))),
          ),
        ]
      }

      function addRoot() {
        var value = rootDraft.trim()
        if (value === '' || busy) return
        var config = library.config || { roots: [] }
        var roots = Array.isArray(config.roots) ? config.roots.slice() : []
        if (roots.indexOf(value) >= 0) return
        roots.push(value)
        setBusy(true)
        saveConfig({ roots: roots }).then(function (ok) {
          setBusy(false)
          if (ok) {
            setRootDraft('')
            showToast(t('page.addedCount', { n: roots.length }))
          }
        })
      }

      function cacheTab() {
        var stats = cache || { files: 0, bytes: 0, maxBytes: 0 }
        return [
          h('h2', { key: 'h' }, t('v2.cacheTab')),
          h(
            SetRow,
            { key: 'size', label: t('online.cacheSize', { files: stats.files || 0, n: fmtBytes(stats.bytes || 0) }), desc: t('online.cacheList') },
            h(Button, {
              variant: 'ghost',
              icon: 'trash',
              onClick: function () {
                postJson(API + 'online/cache', {})
                  .then(function () {
                    setCache({ files: 0, bytes: 0, maxBytes: stats.maxBytes || 0 })
                    setCacheSongs([])
                    showToast(t('online.cacheCleared'))
                  })
                  .catch(function (error) {
                    showToast(errorText(error))
                  })
              },
              children: t('online.clearCache'),
            }),
          ),
          h(
            'p',
            { key: 'hint', className: 'mp-set-desc' },
            t('online.cacheListHint'),
          ),
          h(
            'div',
            { key: 'songs', className: 'mp-cache-block' },
            h('div', { className: 'mp-cache-heading' }, t('online.cacheSongs'), h('span', null, String((cacheSongs || []).length))),
            (cacheSongs || []).length === 0
              ? h('div', { className: 'mp-cache-empty' }, t('online.cacheNoSongs'))
              : h(
                  'div',
                  { className: 'mp-cache-list' },
                  cacheSongs.map(function (song) {
                    return h(
                      'div',
                      { key: song.provider + ':' + song.id, className: 'mp-cache-row' },
                      h('span', { className: 'mp-cache-provider' }, providerLogo(song.provider, 18)),
                      h(
                        'div',
                        { className: 'mp-cache-main' },
                        h('div', { className: 'mp-cache-title' }, song.title || song.id),
                        h(
                          'div',
                          { className: 'mp-cache-sub' },
                          [song.artist, song.album].filter(Boolean).join(' · ') || t('page.unknownArtist'),
                        ),
                      ),
                      h('span', { className: 'mp-cache-time' }, fmtTime(song.durationSec)),
                      h('span', { className: 'mp-cache-size' }, fmtBytes(song.size || 0)),
                      song.hasLyric ? h('span', { className: 'mp-cache-tag' }, 'LRC') : null,
                    )
                  }),
                ),
          ),
        ]
      }

      function aboutTab() {
        return [
          h('h2', { key: 'h' }, t('v2.about')),
          h(
            'div',
            { key: 'card', className: 'mp-about-card' },
            h('img', { className: 'mp-about-logo', src: BRAND_LOGO, alt: '' }),
            h(
              'div',
              { className: 'mp-about-main' },
              h('div', { className: 'mp-about-name' }, 'dsh-music-panel'),
              h('div', { className: 'mp-about-version' }, t('about.version') + ' ' + APP_VERSION),
              h('div', { className: 'mp-about-tagline' }, t('about.tagline')),
            ),
          ),
          h(
            'div',
            { key: 'meta', className: 'mp-about-rows' },
            h('div', { className: 'mp-about-row' }, h('span', null, t('about.project')), h('strong', null, 'DeepSeek Harness Music Panel')),
            h('div', { className: 'mp-about-row' }, h('span', null, t('about.license')), h('strong', null, 'MIT')),
            h('div', { className: 'mp-about-row' }, h('span', null, t('about.author')), h('strong', null, 'Aliboder')),
            h(
              'div',
              { className: 'mp-about-row' },
              h('span', null, t('about.feedback')),
              h(
                'a',
                { href: 'https://github.com/Aliboder/dsh-music-panel/issues', target: '_blank', rel: 'noreferrer' },
                'GitHub Issues',
              ),
            ),
          ),
          h(
            'div',
            { key: 'links', className: 'mp-about-links' },
            h(
              'a',
              { href: 'https://github.com/Aliboder/dsh-music-panel', target: '_blank', rel: 'noreferrer' },
              t('about.source'),
            ),
            h(
              'a',
              { href: 'https://www.npmjs.com/package/dsh-music-panel', target: '_blank', rel: 'noreferrer' },
              t('about.npm'),
            ),
          ),
          h('p', { key: 'desc', className: 'mp-set-desc' }, t('about.description')),
        ]
      }

      var body =
        tab === 'appearance'
          ? appearanceTab()
          : tab === 'lyrics'
            ? lyricsTab()
            : tab === 'playback'
              ? playbackTab()
              : tab === 'online'
                ? onlineTab()
                : tab === 'library'
                  ? libraryTab()
                  : tab === 'cache'
                    ? cacheTab()
                    : aboutTab()

      return h(
        KitModal,
        { headless: true, onClose: props.onClose, className: 'mp-kit-sheet' },
        h(
          'div',
          { className: 'mp-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('page.settings') },
          h(
            'div',
            { className: 'mp-sheet-nav' },
            h('div', { className: 'mp-sheet-title' }, t('page.settings')),
            SETTINGS_TABS.map(function (item) {
              return h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  className: cx('mp-sheet-tab', tab === item.key && 'is-on'),
                  onClick: function () {
                    setTab(item.key)
                  },
                },
                t(item.label),
              )
            }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mp-sheet-close',
              title: t('v2.close'),
              'aria-label': t('v2.close'),
              onClick: props.onClose,
            },
            icon('x', 16),
          ),
          h('div', { className: 'mp-sheet-body' }, body),
        ),
      )
    }

    // ── src/ui/07-dialogs.js
    /**
     * dialogs: context menu, login, tag editor, add-to-playlist, confirm and toast.
     */

    function ContextMenu(props) {
      var layer = props.layer
      var track = layer.props.track
      var online = typeof track.onlineProvider === 'string' && track.onlineProvider !== ''
      var favorite = libraryStore.get().favorites.indexOf(track.path) >= 0
      var items = []
      var likedPair = useState(false)
      var liked = likedPair[0]
      var setLiked = likedPair[1]

      useEffect(
        function () {
          if (!online) return undefined
          var cancelled = false
          getJson(
            API +
              'online/liked?provider=' +
              encodeURIComponent(track.onlineProvider) +
              '&id=' +
              encodeURIComponent(track.onlineId || ''),
          )
            .then(function (body) {
              if (!cancelled) setLiked(body.liked === true)
            })
            .catch(function () {
              // Not signed in / unavailable: keep the neutral state.
            })
          return function () {
            cancelled = true
          }
        },
        [online, track.onlineProvider, track.onlineId],
      )

      useEffect(function () {
        function onDown(event) {
          var node = event.target
          if (node && typeof node.closest === 'function' && node.closest('.mp-ctx')) return
          removeLayer('menu')
        }
        function onScroll() {
          removeLayer('menu')
        }
        document.addEventListener('pointerdown', onDown, true)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        return function () {
          document.removeEventListener('pointerdown', onDown, true)
          window.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', onScroll)
        }
      }, [])

      var selection = selectionStore.get()
      // A single selected row keeps its normal track menu. Batch actions only make
      // sense once more than one track is actually selected.
      var multi =
        selection.active === true &&
        selection.paths.length > 1 &&
        selection.paths.indexOf(track.path) >= 0
      if (multi) {
        var selectedPaths = selection.paths.slice()
        if (online) {
          if (typeof layer.props.playSelected === 'function') {
            items.push({
              key: 'play',
              icon: 'play',
              label: t('page.playSelected'),
              run: function () {
                layer.props.playSelected()
              },
            })
          }
          items.push({
            key: 'select-none',
            icon: 'x',
            label: t('page.selectNone'),
            run: clearSelection,
          })
          items.push({
            key: 'done',
            icon: 'check',
            label: t('page.done'),
            run: function () {
              setSelectionMode(false)
            },
          })
          } else {
        var library = libraryStore.get()
        var favoriteSet = {}
        ;(library.favorites || []).forEach(function (path) {
          favoriteSet[path] = true
        })
        var allFavorite = selectedPaths.every(function (path) {
          return favoriteSet[path] === true
        })
        var selectedTracks = (library.tracks || []).filter(function (item) {
          return selectedPaths.indexOf(item.path) >= 0
        })
        if (Array.isArray(layer.props.visiblePaths) && layer.props.visiblePaths.length > 0) {
          var visiblePaths = layer.props.visiblePaths
          items.push({
            key: 'select-all',
            icon: 'checkCircle',
            label: t('page.selectAll'),
            run: function () {
              selectAllPaths(visiblePaths)
            },
          })
        }
        items.push({
          key: 'select-none',
          icon: 'x',
          label: t('page.selectNone'),
          run: clearSelection,
        })
        items.push({
          key: 'done',
          icon: 'check',
          label: t('page.done'),
          run: function () {
            setSelectionMode(false)
          },
        })
        items.push({ key: 'sep-select', separator: true })
        items.push({
          key: 'play',
          icon: 'play',
          label: t('page.playSelected'),
          run: function () {
            if (selectedTracks.length > 0) player.playList(selectedTracks, 0)
          },
        })
        items.push({
          key: 'fav',
          icon: 'heart',
          label: allFavorite ? t('page.unfavorite') : t('page.favoriteSelected'),
          run: function () {
            var targets = allFavorite
              ? selectedPaths.slice()
              : selectedPaths.filter(function (path) {
                  return favoriteSet[path] !== true
                })
            void (async function () {
              try {
                for (var index = 0; index < targets.length; index += 1) await toggleFavorite(targets[index])
                showToast(allFavorite ? t('page.unfavorite') : t('page.favoriteSelected'))
              } catch (error) {
                showToast(errorText(error))
              }
            })()
          },
        })
        items.push({
          key: 'add',
          icon: 'plus',
          label: t('page.addToPlaylist'),
          run: function () {
            pushLayer('addTo', { paths: selectedPaths.slice() })
          },
        })
        items.push({
          key: 'batch',
          icon: 'edit',
          label: t('page.batchEdit'),
          run: function () {
            pushLayer('batchEdit', { paths: selectedPaths.slice() })
          },
        })
        items.push({ key: 'sep-multi', separator: true })
        items.push({
          key: 'delete',
          icon: 'trash',
          label: t('page.delete'),
          danger: true,
          run: function () {
            var paths = selectedPaths.slice()
            pushLayer('confirm', {
              title: t('page.delete'),
              text: t('v2.removeSelectedConfirm', { n: paths.length }),
              onConfirm: function () {
                removeTracks(paths)
                  .then(function (body) {
                    showToast(t('v2.removed', { n: (body.moved || []).length }))
                  })
                  .catch(function (error) {
                    showToast(errorText(error))
                  })
              },
            })
          },
        })
        }
      } else {
      items.push({
        key: 'play',
        icon: 'play',
        label: t('page.play'),
        run: function () {
          if (layer.props.onPlay) layer.props.onPlay(track)
          else player.playList([track], 0)
        },
      })
      items.push({
        key: 'next',
        icon: 'list',
        label: t('page.next'),
        run: function () {
          player.enqueueNext(track)
          showToast(t('page.addedNext'))
        },
      })
      if (online) {
        items.push({
          key: 'fav',
          icon: liked ? 'heartFill' : 'heart',
          label: liked ? t('page.unfavorite') : t('page.favorite'),
          run: function () {
            var next = !liked
            postJson(API + 'online/like', { provider: track.onlineProvider, song: track, on: next })
              .then(function () {
                setLiked(next)
                refreshLikedPlaylist(next ? 1 : -1)
                showToast(next ? t('page.favorite') : t('page.unfavorite'))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
        items.push({
          key: 'add-cloud',
          icon: 'plus',
          label: t('online.addToCloudPlaylist'),
          run: function () {
            pushLayer('onlineAddTo', { track: track })
          },
        })
      } else {
        items.push({
          key: 'fav',
          icon: favorite ? 'heartFill' : 'heart',
          label: favorite ? t('page.unfavorite') : t('page.favorite'),
          run: function () {
            void toggleFavorite(track.path)
          },
        })
        items.push({
          key: 'add',
          icon: 'plus',
          label: t('page.addToPlaylist'),
          run: function () {
            pushLayer('addTo', { track: track })
          },
        })
      }
      if (layer.props.onRemove) {
        items.push({
          key: 'remove',
          icon: 'trash',
          label: online ? t('online.removeFromHistory') : t('page.removeTrack'),
          run: layer.props.onRemove,
        })
      }
      items.push({ key: 'sep1', separator: true })
      if (!online) {
        items.push({
          key: 'tags',
          icon: 'edit',
          label: t('page.editMeta'),
          run: function () {
            pushLayer('tag', { path: track.path })
          },
        })
        items.push({
          key: 'reveal',
          icon: 'folder',
          label: t('page.reveal'),
          run: function () {
            postJson(API + 'reveal', { path: track.path })
              .then(function () {
                showToast(t('page.revealed'))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
      }
      if (!online) {
        items.push({
          key: 'copy',
          icon: 'copy',
          label: t('page.copyPath'),
          run: function () {
            var path = track.path
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                void navigator.clipboard.writeText(path)
              }
            } catch (error) {
              // Clipboard can be blocked; the toast still confirms the intent.
            }
            showToast(t('page.copied'))
          },
        })
      }

        }
    var width = 190
      var height = items.length * 32 + 8
      var left = Math.max(8, Math.min(layer.props.x || 0, Math.max(8, window.innerWidth - width - 12)))
      var top = Math.max(8, Math.min(layer.props.y || 0, Math.max(8, window.innerHeight - height - 12)))

      // Host menus anchor to a trigger and fall back to a corner; context menus
      // must follow the pointer, so always use the custom fixed menu here.
      var HostMenu = null
      if (HostMenu !== null) {
        var hostItems = items.map(function (item) {
          if (item.separator) return { type: 'separator', id: item.key }
          return { id: item.key, label: item.label, icon: icon(item.icon, 14) }
        })
        return h(HostMenu, {
          open: true,
          anchor: null,
          items: hostItems,
          contextual: true,
          portal: true,
          side: 'bottom',
          align: 'start',
          getAnchorRect: function () {
            return { left: left, top: top, right: left, bottom: top, width: 0, height: 0, x: left, y: top }
          },
          onSelect: function (id) {
            popLayer()
            var chosen = null
            items.forEach(function (item) {
              if (chosen === null && item.key === id) chosen = item
            })
            if (chosen !== null && typeof chosen.run === 'function') chosen.run()
          },
          onClose: function () {
            popLayer()
          },
        })
      }

      return h(
        'div',
        { className: 'mp-ctx', style: { left: left + 'px', top: top + 'px' }, role: 'menu' },
        items.map(function (item) {
          if (item.separator) return h('hr', { key: item.key })
          return h(
            'button',
            {
              key: item.key,
              type: 'button',
              role: 'menuitem',
              onClick: function () {
                popLayer()
                item.run()
              },
            },
            icon(item.icon, 14),
            item.label,
          )
        }),
      )
    }

    function AddToPlaylistDialog(props) {
      var library = useStore(libraryStore)
      var layerProps = props.layer.props || {}
      var paths = Array.isArray(layerProps.paths)
        ? layerProps.paths.slice()
        : layerProps.track
          ? [layerProps.track.path]
          : []
      var playlists = library.playlists
      var pair = useState('')
      var name = pair[0]
      var setName = pair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]

      function addTo(id) {
        if (busy || paths.length === 0) return
        setBusy(true)
        addToPlaylist(id, paths).then(function (ok) {
          setBusy(false)
          if (ok) {
            popLayer()
            showToast(t('page.addedToPlaylist'))
          }
        })
      }

      function createAndAdd() {
        var value = name.trim()
        if (value === '' || busy) return
        setBusy(true)
        createPlaylist(value).then(function (created) {
          if (created && created.id) return addToPlaylist(created.id, paths)
          return false
        }).then(function (ok) {
          setBusy(false)
          if (ok !== false) {
            popLayer()
            showToast(t('page.addedToPlaylist'))
          }
        })
      }

      return h(
        KitModal,
        {
          title: t('page.addToPlaylist'),
          small: true,
          onClose: popLayer,
        },
        playlists.length === 0
          ? h('p', { className: 'mp-set-desc' }, t('v2.noPlaylists'))
          : playlists.map(function (playlist) {
              return h(
                'button',
                {
                  key: playlist.id,
                  type: 'button',
                  className: 'mp-srow',
                  onClick: function () {
                    addTo(playlist.id)
                  },
                },
                h('div', { className: 'mp-srow-cover' }, icon('list', 16)),
                h(
                  'div',
                  { className: 'mp-srow-main' },
                  h('div', { className: 'mp-srow-title' }, playlist.name),
                  h('div', { className: 'mp-srow-sub' }, (playlist.trackPaths || []).length + ''),
                ),
                icon('chevronRight', 14),
              )
            }),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', paddingTop: '6px' } },
          h('input', {
            type: 'text',
            value: name,
            placeholder: t('v2.newPlaylist'),
            className: 'mp-kit-input',
            onChange: function (event) {
              setName(event.target.value)
            },
          }),
          h(Button, { variant: 'primary', icon: 'plus', disabled: busy, onClick: createAndAdd }, t('page.create')),
        ),
      )
    }

    function LoginDialog(props) {
      var provider = props.layer.props.provider || 'netease'
      var mode = props.layer.props.mode || 'qq'
      var qrPair = useState(null)
      var qr = qrPair[0]
      var setQr = qrPair[1]
      var statusPair = useState('waiting')
      var status = statusPair[0]
      var setStatus = statusPair[1]
      var errorPair = useState('')
      var error = errorPair[0]
      var setError = errorPair[1]
      var attemptPair = useState(0)
      var attempt = attemptPair[0]
      var setAttempt = attemptPair[1]

      function retry() {
        setError('')
        setStatus('waiting')
        setQr(null)
        setAttempt(attempt + 1)
      }

      useEffect(
        function () {
          var cancelled = false
          var timer = null
          startProviderLogin(provider, mode)
            .then(function (body) {
              if (cancelled) return
              setQr(body)
              timer = setInterval(function () {
                checkProviderLogin(provider, body.key, body.mode || mode)
                  .then(function (next) {
                    if (cancelled) return
                    setStatus(next)
                    if (next === 'success') {
                      clearInterval(timer)
                      timer = null
                      resetOnlineAccountData()
                      void loadProviders()
                      void loadMyPlaylists(provider)
                      showToast(t('online.loginSuccess'))
                      popLayer()
                    }
                    if (next === 'expired' || next === 'failed') {
                      clearInterval(timer)
                      timer = null
                    }
                  })
                  .catch(function (pollError) {
                    if (cancelled) return
                    setError(errorText(pollError))
                  })
              }, 2000)
            })
            .catch(function (startError) {
              if (cancelled) return
              setError(errorText(startError))
            })
          return function () {
            cancelled = true
            if (timer !== null) clearInterval(timer)
          }
        },
        [provider, mode, attempt],
      )

      var providerLabel =
        provider === 'netease'
          ? t('online.providerNetease')
          : provider === 'qq'
            ? t('online.providerQq')
            : t('online.providerKugou')

      var failed = error !== '' || status === 'expired' || status === 'failed'
      var statusLabel =
        error !== ''
          ? error
          : status === 'scanned'
            ? t('online.statusscanned')
            : status === 'success'
              ? t('online.statussuccess')
              : status === 'expired'
                ? t('online.statusexpired')
                : status === 'failed'
                  ? t('online.statusfailed')
                  : t('online.statuswaiting')
      return h(
        KitModal,
        {
          title: '',
          small: true,
          onClose: popLayer,
        },
        h(
          'div',
          { className: 'mp-login-card' },
          h(
            'div',
            { className: 'mp-login-head' },
            h('span', { className: 'mp-login-logo' }, providerLogo(provider, 34)),
            h(
              'div',
              { className: 'mp-login-headtext' },
              h('div', { className: 'mp-login-title' }, t('online.loginTitle', { provider: providerLabel })),
              h('div', { className: 'mp-login-sub' }, t('online.qrDesc', { provider: providerLabel })),
            ),
          ),
          h(
            'div',
            { className: 'mp-login-qr-shell' },
            h(
              'div',
              { className: cx('mp-login-qr-frame', status === 'scanned' && 'is-scanned') },
              qr && qr.imageDataUrl
                ? h('img', { className: 'mp-login-qr-img', src: qr.imageDataUrl, alt: '' })
                : h(
                    'div',
                    { className: 'mp-login-qr-loading' },
                    h('span', { className: 'mp-login-spinner' }),
                    h('span', null, t('online.qrLoading')),
                  ),
              h('i', { className: 'mp-login-corner tl' }),
              h('i', { className: 'mp-login-corner tr' }),
              h('i', { className: 'mp-login-corner bl' }),
              h('i', { className: 'mp-login-corner br' }),
            ),
          ),
          h(
            'div',
            { className: cx('mp-login-status', failed && 'is-error', status === 'scanned' && 'is-scanned', status === 'success' && 'is-success') },
            h('span', { className: 'mp-login-dot' }),
            h('span', null, statusLabel),
          ),
          h(
            'div',
            { className: 'mp-login-steps' },
            h('div', { className: 'mp-login-step' }, h('b', null, '1'), h('span', null, t('online.qrStep1'))),
            h('div', { className: 'mp-login-step' }, h('b', null, '2'), h('span', null, t('online.qrStep2'))),
          ),
          h('div', { className: 'mp-login-secure' }, icon('checkCircle', 12), h('span', null, t('online.qrSecure'))),
          failed
            ? h(
                'div',
                { className: 'mp-login-actions' },
                h(Button, { variant: 'primary', icon: 'refresh', onClick: retry, children: t('online.qrRefresh') }),
                h(Button, { variant: 'ghost', onClick: popLayer, children: t('v2.close') }),
              )
            : null,
        ),
      )
    }

    var TAG_FIELDS = [
      ['title', 'page.metaTitle'],
      ['artist', 'page.artist'],
      ['album', 'page.album'],
      ['albumArtist', 'page.albumArtist'],
      ['year', 'page.year'],
      ['genre', 'page.genre'],
      ['track', 'page.trackNo'],
      ['disc', 'page.discNo'],
      ['composer', 'page.composer'],
      ['lyricist', 'page.lyricist'],
      ['comment', 'page.comment'],
    ]

    var TAG_MATCH_FIELDS = [
      ['title', 'page.metaTitle'],
      ['artist', 'page.artist'],
      ['album', 'page.album'],
      ['year', 'page.year'],
      ['genre', 'page.genre'],
      ['track', 'page.trackNo'],
      ['disc', 'page.discNo'],
    ]

    function tagSourceLabel(source) {
      if (source === 'netease') return t('page.sourceNetease')
      if (source === 'qq') return t('page.sourceQq')
      if (source === 'itunes') return t('page.sourceItunes')
      if (source === 'musicbrainz') return t('page.sourceMusicbrainz')
      return String(source || '')
    }

    function TagDialog(props) {
      var path = props.layer.props.path
      var tagsPair = useState(null)
      var tags = tagsPair[0]
      var setTags = tagsPair[1]
      var errorPair = useState('')
      var error = errorPair[0]
      var setError = errorPair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var formPair = useState({})
      var form = formPair[0]
      var setForm = formPair[1]
      var coverPair = useState(null)
      var coverPreview = coverPair[0]
      var setCoverPreview = coverPair[1]
      var matchPair = useState(false)
      var matchOpen = matchPair[0]
      var setMatchOpen = matchPair[1]
      var matchPhasePair = useState('idle')
      var matchPhase = matchPhasePair[0]
      var setMatchPhase = matchPhasePair[1]
      var matchListPair = useState([])
      var matchResults = matchListPair[0]
      var setMatchResults = matchListPair[1]

      useEffect(
        function () {
          var cancelled = false
          getJson(API + 'tags?path=' + encodeURIComponent(path))
            .then(function (body) {
              if (cancelled) return
              var loaded = body.tags || {}
              setTags(loaded)
              var next = {}
              TAG_FIELDS.forEach(function (entry) {
                var value = loaded[entry[0]]
                next[entry[0]] = value === undefined || value === null ? '' : String(value)
              })
              next.lyrics = typeof loaded.lyrics === 'string' ? loaded.lyrics : ''
              setForm(next)
            })
            .catch(function (loadError) {
              if (!cancelled) setError(errorText(loadError))
            })
          return function () {
            cancelled = true
          }
        },
        [path],
      )

      function setField(key, value) {
        setForm(function (previous) {
          var next = Object.assign({}, previous)
          next[key] = value
          return next
        })
      }

      function field(key) {
        return h(
          'div',
          { className: 'mp-field' },
          h('label', null, t(TAG_FIELDS.find(function (entry) { return entry[0] === key })[1])),
          h('input', {
            type: 'text',
            value: form[key] || '',
            onChange: function (event) {
              setField(key, event.target.value)
            },
          }),
        )
      }

      function runMatch() {
        if (matchPhase === 'loading') return
        setMatchOpen(true)
        setMatchPhase('loading')
        setMatchResults([])
        setError('')
        postJson(API + 'online-search', {
          title: form.title || '',
          artist: form.artist || '',
          album: form.album || '',
        })
          .then(function (body) {
            setMatchResults(Array.isArray(body.results) ? body.results : [])
            setMatchPhase('ready')
          })
          .catch(function (matchError) {
            setError(errorText(matchError))
            setMatchPhase('error')
          })
      }

      function pickMatch(item) {
        var next = Object.assign({}, form)
        ;['title', 'artist', 'album', 'year', 'track', 'disc', 'genre'].forEach(function (key) {
          if (item[key] !== undefined && item[key] !== null && String(item[key]) !== '') {
            next[key] = String(item[key])
          }
        })
        setForm(next)
        if (item.coverUrl) setCoverPreview(item.coverUrl)
        setMatchOpen(false)
        setMatchPhase('idle')
      }

      function applyMatchField(item, key) {
        if (key === 'cover') {
          if (item.coverUrl) setCoverPreview(item.coverUrl)
          return
        }
        if (item[key] === undefined || item[key] === null || String(item[key]) === '') return
        setField(key, String(item[key]))
      }

      function openOnlineLyric() {
        pushLayer('onlineLyric', {
          track: { path: path, title: form.title || '', artist: form.artist || '' },
          onApply: function (lrc) {
            setField('lyrics', lrc)
          },
        })
      }

      function save() {
        if (busy) return
        setBusy(true)
        setError('')
        var current = player.getSnapshot()
        var playingThis =
          current.index >= 0 && current.queue[current.index] && current.queue[current.index].path === path
        if (playingThis) player.suspend()
        function restorePlayback() {
          if (playingThis && !player.getSnapshot().playing) player.toggle()
        }
        sendJson('PUT', API + 'tags', {
          path: path,
          tags: form,
          coverUrl: coverPreview || '',
        })
          .then(function () {
            setBusy(false)
            restorePlayback()
            popLayer()
            showToast(t('page.metaSaved'))
            void loadLibrary(true)
          })
          .catch(function (saveError) {
            setBusy(false)
            restorePlayback()
            setError(errorText(saveError))
          })
      }

      var coverSrc =
        coverPreview !== null && coverPreview !== undefined
          ? API + 'online/cover?url=' + encodeURIComponent(coverPreview)
          : API + 'cover?path=' + encodeURIComponent(path)
      var fileName = String(path || '').split(/[\\/]/).pop() || ''
      var lyricLineCount = String(form.lyrics || '')
        .split(/\r?\n/)
        .filter(function (line) {
          return line.trim() !== ''
        }).length

      function section(title, body, extra) {
        return h(
          'section',
          { className: 'mp-tag-section' },
          h(
            'div',
            { className: 'mp-tag-section-head' },
            h('h3', { className: 'mp-tag-section-title' }, title),
            extra ? h('div', { className: 'mp-tag-section-extra' }, extra) : null,
          ),
          h('div', { className: 'mp-tag-section-body' }, body),
        )
      }

      return h(
        KitModal,
        {
          title: t('page.editMeta'),
          onClose: popLayer,
          footer: h(
            'div',
            { className: 'mp-tag-footer' },
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'save',
                variant: 'primary',
                disabled: busy,
                onClick: save,
              },
              busy ? t('page.saving') : t('page.save'),
            ),
          ),
        },
    h(
            'div',
            { className: 'mp-kit-body mp-tag-body' },
            error !== '' ? h('div', { className: 'mp-qr-hint' }, error) : null,
            h(
              'div',
              { className: 'mp-tag-layout' },
              h(
                'aside',
                { className: 'mp-tag-aside' },
                h(Cover, { src: coverSrc, className: 'mp-tag-cover', iconSize: 52 }),
                h('div', { className: 'mp-tag-aside-title' }, form.title || fileName || t('page.editMeta')),
                h('div', { className: 'mp-tag-aside-artist' }, form.artist || t('page.unknownArtist')),
                h(
                  'div',
                  { className: 'mp-tag-aside-meta' },
                  [tags && tags.format, fileName].filter(Boolean).join(' · '),
                ),
                h(
                  'div',
                  { className: 'mp-tag-aside-actions' },
                  h(Button, { icon: 'search', onClick: runMatch, disabled: matchPhase === 'loading' }, t('v2.match')),
                  coverPreview !== null
                    ? h(Button, { variant: 'ghost', icon: 'refresh', onClick: function () { setCoverPreview(null) } }, t('page.resetCover'))
                    : null,
                ),
                h('div', { className: 'mp-tag-hint' }, t('page.metaHint')),
              ),
              h(
                'div',
                { className: 'mp-tag-form' },
            matchOpen
              ? h(
                  'div',
                  { className: 'mp-match' },
                  h(
                    'div',
                    { className: 'mp-match-head' },
                    h('span', null, t('page.onlineResults')),
                    h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
                    h(IconButton, {
                      icon: 'x',
                      size: 14,
                      title: t('v2.close'),
                      onClick: function () {
                        setMatchOpen(false)
                      },
                    }),
                  ),
                  matchPhase === 'loading'
                    ? h('div', { className: 'mp-empty', style: { padding: '18px' } }, h(Spinner), t('page.onlineLoading'))
                    : matchResults.length === 0
                      ? h('div', { className: 'mp-empty', style: { padding: '18px' } }, t('page.onlineEmpty'))
                      : matchResults.map(function (item, index) {
                          var chipFields = TAG_MATCH_FIELDS.filter(function (entry) {
                            return item[entry[0]] !== undefined && item[entry[0]] !== null && String(item[entry[0]]) !== ''
                          })
                          if (item.coverUrl) chipFields.push(['cover', 'v2.cover'])
                          return h(
                            'div',
                            { key: String(index), className: 'mp-match-row' },
                            h(
                              'button',
                              {
                                type: 'button',
                                className: 'mp-match-item',
                                onClick: function () {
                                  pickMatch(item)
                                },
                              },
                              item.coverUrl
                                ? h(Cover, {
                                    src: API + 'online/cover?url=' + encodeURIComponent(item.coverUrl),
                                    className: 'mp-match-cover',
                                    iconSize: 16,
                                  })
                                : h('div', { className: 'mp-match-cover' }, icon('note', 16)),
                              h(
                                'div',
                                { className: 'mp-match-main' },
                                h('div', { className: 'mp-srow-title' }, item.title || ''),
                                h(
                                  'div',
                                  { className: 'mp-srow-sub' },
                                  [item.artist, item.album, item.year, tagSourceLabel(item.source)]
                                    .filter(function (part) {
                                      return part !== '' && part !== undefined && part !== null
                                    })
                                    .join(' · '),
                                ),
                              ),
                            ),
                            chipFields.length > 0
                              ? h(
                                  'div',
                                  { className: 'mp-match-fields' },
                                  chipFields.map(function (entry) {
                                    return h(
                                      'button',
                                      {
                                        key: entry[0],
                                        type: 'button',
                                        className: 'mp-match-chip',
                                        onClick: function () {
                                          applyMatchField(item, entry[0])
                                        },
                                      },
                                      t(entry[1]),
                                    )
                                  }),
                                )
                              : null,
                          )
                        }),
                  h('div', { className: 'mp-np-setting-hint' }, t('v2.matchHint')),
                  h('div', { className: 'mp-np-setting-hint' }, t('page.onlineHint')),
                )
              : null,
            section(
              t('page.metaBasic'),
              h(
                'div',
                { className: 'mp-tag-grid' },
                field('title'),
                field('artist'),
                field('album'),
                field('albumArtist'),
              ),
            ),
            section(
              t('page.metaDetail'),
              [
                h(
                  'div',
                  { key: 'release', className: 'mp-tag-grid' },
                  field('year'),
                  field('genre'),
                  field('track'),
                  field('disc'),
                ),
                h(
                  'div',
                  { key: 'credits', className: 'mp-tag-grid' },
                  field('composer'),
                  field('lyricist'),
                ),
                h(
                  'div',
                  { key: 'comment', className: 'mp-field' },
                  h('label', null, t('page.comment')),
                  h('input', {
                    type: 'text',
                    value: form.comment || '',
                    onChange: function (event) {
                      setField('comment', event.target.value)
                    },
                  }),
                ),
              ],
            ),
            section(
              t('page.lyrics'),
              h(
                'div',
                { className: 'mp-field mp-tag-lyrics' },
                h('textarea', {
                  rows: 8,
                  value: form.lyrics || '',
                  placeholder: t('page.lyricsPlaceholder'),
                  onChange: function (event) {
                    setField('lyrics', event.target.value)
                  },
                }),
              ),
              h(
                'div',
                { className: 'mp-tag-lyrics-actions' },
                h('span', { className: 'mp-tag-section-meta' }, t('page.lyricsLineCount', { n: lyricLineCount })),
                h(Button, { variant: 'ghost', icon: 'search', onClick: openOnlineLyric }, t('page.onlineLyrics')),
              ),
            ),
              ),
            ),
          ),

      )
    }

    function ConfirmDialog(props) {
      var layer = props.layer
      return h(
        KitModal,
        {
          title: layer.props.title || '',
          small: true,
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'ok',
                variant: 'primary',
                onClick: function () {
                  var action = layer.props.onConfirm
                  popLayer()
                  if (typeof action === 'function') action()
                },
              },
              t('page.done'),
            ),
          ],
        },
        h('p', { className: 'mp-kit-text' }, layer.props.text || ''),
      )
    }

    function Toast(props) {
      var toast = useStore(toastStore)
      var HostToast = hostComponent('Toast')
      if (HostToast !== null && toast.text !== '') {
        return h(HostToast, {
          key: toast.seq,
          text: toast.text,
          holdMs: 1800,
          onDone: function () {
            if (toastStore.get().seq === toast.seq) toastStore.set({ text: '', seq: toast.seq })
          },
        })
      }
      return h(
        'div',
        { className: cx('mp-toast', toast.text !== '' && 'is-on'), role: 'status' },
        toast.text,
      )
    }

    // ── src/ui/08-local.js
    /**
     * local views: songs, albums, artists, folders, favorites, playlists, stats.
     *
     * One header + one toolbar + one scrolling body per view; the body is either
     * the shared virtual list or a plain scroll box for grids/statistics.
     */

    function filterLabelOf(ui) {
      if (!ui.filter) return ''
      if (ui.filter.kind === 'album') return t('v2.albumFilter', { name: ui.filter.value })
      if (ui.filter.kind === 'artist') return t('v2.artistFilter', { name: ui.filter.value })
      return t('v2.folderFilter', { name: ui.filter.value })
    }

    function applyUiFilter(list, filter) {
      if (!filter) return list
      return list.filter(function (track) {
        if (filter.kind === 'album') return (track.album || t('page.unknownAlbum')) === filter.value
        if (filter.kind === 'artist') {
          var artistNames = trackArtistNames(track)
          if (artistNames.length === 0) artistNames = [t('page.unknownArtist')]
          return artistNames.indexOf(filter.value) >= 0
        }
        if (filter.kind === 'folder') return trackDirOf(track) === filter.value || track.folder === filter.value
        return true
      })
    }

    function groupTracks(list, keyOf) {
      var map = {}
      var order = []
      list.forEach(function (track) {
        var key = keyOf(track)
        if (!map[key]) {
          map[key] = { key: key, tracks: [] }
          order.push(key)
        }
        map[key].tracks.push(track)
      })
      return order.map(function (key) {
        return map[key]
      })
    }

    function playListFrom(list) {
      if (!list || list.length === 0) return
      player.playList(list, 0)
    }

    function shuffleListFrom(list) {
      if (!list || list.length === 0) return
      player.setOrder('random')
      player.playList(list, Math.floor(Math.random() * list.length))
    }

    function sortSelect(prefs) {
      return h(
        'select',
        {
          className: 'mp-chip',
          value: prefs.sortBy,
          title: t('page.sort'),
          'aria-label': t('page.sort'),
          onChange: function (event) {
            setPrefs({ sortBy: event.target.value })
          },
        },
        h('option', { value: 'title' }, t('v2.sortTitle')),
        h('option', { value: 'artist' }, t('v2.sortArtist')),
        h('option', { value: 'duration' }, t('v2.sortDuration')),
        h('option', { value: 'added' }, t('v2.sortAdded')),
        h('option', { value: 'recent' }, t('v2.sortRecent')),
      )
    }

    function LocalContent(props) {
      var ui = props.ui
      var library = props.library
      var prefs = props.prefs
      var favorites = props.favoriteSet
      var allTracks = library.tracks || []
      var visible = []
      var title = ''
      var count = 0
      var actions = null
      var toolbarExtras = []
      var body = null
      var empty = null
      var selectionList = []
      var playAll = null
      var selection = useStore(selectionStore)
      var selecting = selection.active === true
      var selectedSet = useMemo(
        function () {
          var set = {}
          selection.paths.forEach(function (path) {
            set[path] = true
          })
          return set
        },
        [selection.paths],
      )
      var duplicateGroups = useMemo(
        function () {
          if (ui.source !== 'local' || ui.nav !== 'songs' || ui.filter || ui.query !== '') return []
          return duplicateGroupsOf(library.tracks || [])
        },
        [ui.source, ui.nav, ui.filter, ui.query, library.tracks],
      )

      function selectTrack(track, additive) {
        selectTrackIn(selectionList, track, additive)
      }

      function listFor(view) {
        var base = allTracks
        if (view === 'favorites') {
          base = allTracks.filter(function (track) {
            return favorites[track.path] === true
          })
        } else if (view === 'playlist') {
          base = playlistTracks(playlistById(ui.playlistId))
        }
        base = applyUiFilter(base, ui.filter)
        return sortTracks(filterTracks(base, ui.query), prefs.sortBy, prefs.sortDir)
      }

      function trackBody(list, resetKey) {
        return h(TrackListBody, {
          items: list,
          resetKey: resetKey,
          focusPath: props.locatePath || '',
          currentPath: props.currentPath,
          playing: props.playing,
          favoriteSet: favorites,
          selectionMode: selecting,
          selectedSet: selectedSet,
          onToggleSelect: function (path) {
            toggleSelected(path)
          },
          onSelect: selectTrack,
          onPlay: function (track) {
            var index = list.indexOf(track)
            player.playList(list, index < 0 ? 0 : index)
          },
          onMenu: function (track, event) {
            props.onMenu(track, event, {
              visiblePaths: list.map(function (item) {
                return item.path
              }),
            })
          },
          onToggleFavorite: props.onToggleFavorite,
          onAlbum: function (track) {
            if (!track || !track.album) return
            setUi({ nav: 'songs', filter: { kind: 'album', value: track.album }, query: '' })
          },
          onArtist: function (track, artist) {
            if (!track || !String(artist || '').trim()) return
            setUi({ nav: 'songs', filter: { kind: 'artist', value: artist }, query: '' })
          },
          empty: empty,
        })
      }

      if (ui.nav === 'songs' || ui.nav === 'favorites' || ui.nav === 'playlist') {
        visible = listFor(ui.nav)
        selectionList = visible
        playAll = visible.length
          ? function () {
              playListFrom(visible)
            }
          : null
        title = ui.filter
          ? ui.filter.value
          : ui.nav === 'favorites'
            ? t('v2.favorites')
            : ui.nav === 'playlist'
              ? (playlistById(ui.playlistId) || {}).name || t('v2.playlists')
              : t('v2.allSongs')
        count = visible.length
        toolbarExtras = []
        if (ui.filter) {
          toolbarExtras.push(
            h(
              'button',
              {
                key: 'clear',
                type: 'button',
                className: 'mp-chip',
                onClick: function () {
                  setUi({ filter: null })
                },
              },
              icon('x', 12),
              t('v2.clearFilter'),
            ),
          )
        }
        if (ui.query !== '') {
          toolbarExtras.push(
            h(
              'button',
              {
                key: 'clearq',
                type: 'button',
                className: 'mp-chip',
                onClick: function () {
                  setUi({ query: '' })
                },
              },
              icon('x', 12),
              t('page.clearFilter') || t('v2.clearFilter'),
            ),
          )
        }
        if (duplicateGroups.length > 0 && !selecting) {
          toolbarExtras.push(
            h(
              'button',
              {
                key: 'dupes',
                type: 'button',
                className: 'mp-chip',
                onClick: function () {
                  pushLayer('duplicates', { groups: duplicateGroups })
                },
              },
              icon('info', 13),
              t('page.duplicates', { n: duplicateGroups.length }),
            ),
          )
        }
        empty =
          ui.nav === 'favorites'
            ? h(Empty, { title: t('v2.noFavorites'), hint: t('v2.noFavoritesHint'), icon: 'heart' })
            : ui.nav === 'playlist'
              ? h(Empty, { title: t('v2.noPlaylistTracks'), hint: t('page.playlistNoTracksHint'), icon: 'list' })
              : ui.query !== '' || ui.filter
                ? h(Empty, { title: t('page.noResults'), hint: '', icon: 'search' })
                : h(Empty, { title: t('v2.noTracks'), hint: t('v2.noTracksHint'), icon: 'note' })
        body = trackBody(visible, [ui.source, ui.nav, ui.playlistId, ui.filter ? ui.filter.kind + ':' + ui.filter.value : '', ui.query].join('|'))
      } else if (ui.nav === 'albums') {
        var albums = groupTracks(filterTracks(applyUiFilter(allTracks, ui.filter), ui.query), function (track) {
          return track.album || t('page.unknownAlbum')
        })
        count = albums.length
        title = t('v2.albums')
        body = h(
          ScrollBox,
          { resetKey: 'albums:' + ui.query },
          albums.map(function (group) {
            var coverTrack = group.tracks.find(function (track) {
              return track.hasCover === true
            })
            return h(
              'button',
              {
                key: group.key,
                type: 'button',
                className: 'mp-srow',
                onClick: function () {
                  setUi({ nav: 'songs', filter: { kind: 'album', value: group.key } })
                },
              },
              h(
                'div',
                { className: 'mp-srow-cover' },
                h(Cover, { src: coverTrack ? trackCoverSrc(coverTrack) : '', iconSize: 18 }),
              ),
              h(
                'div',
                { className: 'mp-srow-main' },
                h('div', { className: 'mp-srow-title' }, group.key),
                h('div', { className: 'mp-srow-sub' }, (group.tracks[0].artist || '') + ' · ' + group.tracks.length),
              ),
              h('div', { className: 'mp-srow-meta' }, String(group.tracks.length)),
              icon('chevronRight', 14),
            )
          }),
        )
        empty = h(Empty, { title: t('page.noResults'), icon: 'disc' })
      } else if (ui.nav === 'artists' || ui.nav === 'folders') {
        var isArtists = ui.nav === 'artists'
        var groupedTracks = filterTracks(allTracks, ui.query)
        var groups
        if (isArtists) {
          var artistGroups = {}
          groupedTracks.forEach(function (track) {
            var names = trackArtistNames(track)
            if (names.length === 0) names = [t('page.unknownArtist')]
            names.forEach(function (name) {
              if (!artistGroups[name]) artistGroups[name] = []
              artistGroups[name].push(track)
            })
          })
          groups = Object.keys(artistGroups).map(function (key) {
            return { key: key, tracks: artistGroups[key] }
          })
        } else {
          groups = groupTracks(groupedTracks, trackDirOf)
        }
        groups.sort(function (left, right) {
          return String(left.key).localeCompare(String(right.key), 'zh')
        })
        count = groups.length
        title = isArtists ? t('v2.artists') : t('v2.folders')
        if (!isArtists) {
          toolbarExtras = [
            h(
              Button,
              {
                key: 'add-folder',
                icon: 'plus',
                onClick: function () {
                  pushLayer('folderPicker')
                },
              },
              t('v2.folderAdd'),
            ),
          ]
        }
        body = h(
          ScrollBox,
          { resetKey: ui.nav + ':' + ui.query },
          groups.map(function (group) {
            var coverTrack = group.tracks.find(function (track) {
              return track.hasCover === true
            })
            return h(
              'button',
              {
                key: group.key,
                type: 'button',
                className: 'mp-srow',
                onClick: function () {
                  setUi({
                    nav: 'songs',
                    filter: isArtists ? { kind: 'artist', value: group.key } : { kind: 'folder', value: group.key },
                  })
                },
              },
              isArtists
                ? h(
                    'div',
                    { className: 'mp-srow-cover is-round' },
                    h(Cover, { src: coverTrack ? trackCoverSrc(coverTrack) : '', iconSize: 18 }),
                  )
                : h('div', { className: 'mp-srow-cover' }, icon('folder', 18)),
              h(
                'div',
                { className: 'mp-srow-main' },
                h('div', { className: 'mp-srow-title' }, isArtists ? group.key : folderNameOf(group.key)),
                isArtists
                  ? h('div', { className: 'mp-srow-sub' }, group.tracks.length + ' · ' + t('v2.songs'))
                  : h('div', { className: 'mp-srow-sub' }, group.key),
              ),
              h('div', { className: 'mp-srow-meta' }, String(group.tracks.length)),
              icon('chevronRight', 14),
            )
          }),
        )
        empty = h(Empty, { title: t('page.noResults'), icon: isArtists ? 'user' : 'folder' })
      } else if (ui.nav === 'playlists') {
        var playlists = library.playlists || []
        count = playlists.length
        title = t('v2.playlists')
        actions = [
          h(
            Button,
            {
              key: 'new',
              variant: 'primary',
              icon: 'plus',
              onClick: function () {
                pushLayer('newPlaylist')
              },
            },
            t('v2.newPlaylist'),
          ),
        ]
        body = h(
          ScrollBox,
          { resetKey: 'playlists' },
          playlists.length === 0
            ? h(Empty, { title: t('v2.noPlaylists'), hint: t('page.playlistEmptyHint'), icon: 'list' })
            : playlists.map(function (playlist) {
                var coverTrack = (playlistTracks(playlist)[0] || null)
                return h(
                  'div',
                  {
                    key: playlist.id,
                    role: 'button',
                    tabIndex: 0,
                    className: 'mp-srow',
                    onClick: function () {
                      openLocalPlaylist(playlist.id)
                    },
                    onKeyDown: function (event) {
                      if (event.key === 'Enter') openLocalPlaylist(playlist.id)
                    },
                  },
                  h(
                    'div',
                    { className: 'mp-srow-cover' },
                    coverTrack ? h(Cover, { src: trackCoverSrc(coverTrack), iconSize: 18 }) : icon('list', 18),
                  ),
                  h(
                    'div',
                    { className: 'mp-srow-main' },
                    h('div', { className: 'mp-srow-title' }, playlist.name),
                    h('div', { className: 'mp-srow-sub' }, (playlist.trackPaths || []).length + ' · ' + t('v2.songs')),
                  ),
                  h(
                    'span',
                    { className: 'mp-srow-meta' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mp-iconbtn',
                        title: t('page.delete'),
                        onClick: function (event) {
                          event.stopPropagation()
                          pushLayer('confirm', {
                            title: t('page.delete'),
                            text: t('page.deleteConfirm', { name: playlist.name }),
                            onConfirm: function () {
                              void removePlaylist(playlist.id)
                            },
                          })
                        },
                      },
                      icon('trash', 14),
                    ),
                  ),
                  icon('chevronRight', 14),
                )
              }),
        )
      } else if (ui.nav === 'stats') {
        title = t('v2.stats')
        count = 0
        var stats = library.stats || {}
        var entries = Object.keys(stats)
          .map(function (path) {
            var track = trackByPath(path)
            if (!track) return null
            var item = stats[path] || {}
            return { track: track, plays: item.plays || 0, seconds: item.playSeconds || 0 }
          })
          .filter(Boolean)
          .sort(function (left, right) {
            return right.seconds - left.seconds
          })
        var totalSeconds = entries.reduce(function (sum, entry) {
          return sum + entry.seconds
        }, 0)
        var totalPlays = entries.reduce(function (sum, entry) {
          return sum + entry.plays
        }, 0)
        var topSeconds = entries.length > 0 ? entries[0].seconds : 1
        toolbarExtras = [
          ['all', 'v2.rangeAll'],
          ['week', 'v2.rangeWeek'],
          ['month', 'v2.rangeMonth'],
        ].map(function (item) {
          return h(
            'button',
            {
              key: item[0],
              type: 'button',
              className: cx('mp-chip', library.statsRange === item[0] && 'is-on'),
              onClick: function () {
                void loadStats(item[0])
              },
            },
            t(item[1]),
          )
        })
        body = h(
          ScrollBox,
          { resetKey: 'stats:' + library.statsRange },
          h(
            'div',
            { className: 'mp-stat-cards' },
            h(
              'div',
              { className: 'mp-stat-card' },
              h('div', { className: 'mp-stat-k' }, t('v2.listenTime')),
              h('div', { className: 'mp-stat-v' }, Math.floor(totalSeconds / 3600) + ' h ' + Math.floor((totalSeconds % 3600) / 60) + ' m'),
            ),
            h(
              'div',
              { className: 'mp-stat-card' },
              h('div', { className: 'mp-stat-k' }, t('v2.totalPlays')),
              h('div', { className: 'mp-stat-v' }, String(totalPlays)),
            ),
            h(
              'div',
              { className: 'mp-stat-card' },
              h('div', { className: 'mp-stat-k' }, t('v2.trackedTracks')),
              h('div', { className: 'mp-stat-v' }, String(entries.length)),
            ),
          ),
          h(
            'div',
            { className: 'mp-rank' },
            entries.slice(0, 12).map(function (entry, index) {
              return h(
                'div',
                {
                  key: entry.track.path,
                  className: 'mp-rank-row',
                  onClick: function () {
                    player.playList(
                      entries.map(function (item) {
                        return item.track
                      }),
                      index,
                    )
                  },
                },
                h('div', { className: 'mp-rank-n' }, String(index + 1)),
                h('div', { className: 'mp-rank-c' }, h(Cover, { src: trackCoverSrc(entry.track), iconSize: 12 })),
                h(
                  'div',
                  { className: 'mp-rank-m' },
                  h('div', { className: 'mp-row-title' }, trackTitleOf(entry.track)),
                  h('div', { className: 'mp-row-sub' }, trackArtistOf(entry.track)),
                ),
                h(
                  'div',
                  { className: 'mp-rank-bar' },
                  h('i', { style: { width: Math.round((entry.seconds / (topSeconds || 1)) * 100) + '%' } }),
                ),
                h('div', { className: 'mp-row-time' }, entry.plays + ' · ' + Math.floor(entry.seconds / 60) + 'm'),
              )
            }),
          ),
        )
      } else {
        title = t('v2.allSongs')
        body = h(Empty, { title: t('page.noResults'), icon: 'note' })
      }

      return [
        h(ContentHeader, {
          key: 'head',
          title: title,
          count: count,
          onAll: function () {
            selectAllIn(selectionList)
          },
          onNone: function () {
            setSelectionMode(false)
          },
          onRange: beginRangePick,
          onInvert: function () {
            invertSelectionIn(selectionList)
          },
          selecting: selecting,
          selectedCount: selection.paths.length,
        }),
        toolbarExtras.length > 0
          ? h(
              'div',
              { className: 'mp-toolbar', key: 'toolbar' },
              toolbarExtras,
            )
          : null,
        h('div', { className: 'mp-content-body', key: 'body', style: { display: 'contents' } }, body),
      ]
    }

    // ── src/ui/09-online.js
    /**
     * online views: recent history, my playlists, one playlist, cache and search.
     */

    /** Rows per page in the paged library view. */
    var SONG_PAGE_SIZE = 100

    function onlineEntriesForHistory(online, provider) {
      return (online.history || []).filter(function (entry) {
        return entry.provider === provider
      })
    }

    /**
     * Page numbers to draw: the first, the last, and a window around the current
     * page, with `null` marking a gap that the caller renders as an ellipsis.
     */
    function pageWindow(current, total) {
      if (total <= 7) {
        var all = []
        for (var i = 1; i <= total; i += 1) all.push(i)
        return all
      }
      var out = [1]
      var from = Math.max(2, current - 1)
      var to = Math.min(total - 1, current + 1)
      if (from > 2) out.push(null)
      for (var p = from; p <= to; p += 1) out.push(p)
      if (to < total - 1) out.push(null)
      out.push(total)
      return out
    }

    function OnlineContent(props) {
      var ui = props.ui
      var online = props.online
      var provider = online.provider
      var nav = ui.nav
      var showingSearch = online.query !== '' && (online.phase === 'searching' || online.phase === 'ready' || online.phase === 'error')
      var cachePair = useState(null)
      var cacheList = cachePair[0]
      var setCacheList = cachePair[1]
      var cachePhasePair = useState('idle')
      var cachePhase = cachePhasePair[0]
      var setCachePhase = cachePhasePair[1]
      // Library-wide song list (Navidrome only; other providers return none).
      var songsPair = useState(null)
      var songsList = songsPair[0]
      var setSongsList = songsPair[1]
      var songsPhasePair = useState('idle')
      var songsPhase = songsPhasePair[0]
      var setSongsPhase = songsPhasePair[1]
      // Native (opt-in) mode pages the whole library, so the view tracks how many
      // rows the server has in total and whether another page exists.
      var songsTotalPair = useState(0)
      var songsTotal = songsTotalPair[0]
      var setSongsTotal = songsTotalPair[1]
      var songsNativePair = useState(false)
      var songsNative = songsNativePair[0]
      var setSongsNative = songsNativePair[1]
      // Native mode is page-numbered, one page in memory at a time.
      var songsPagePair = useState(1)
      var songsPage = songsPagePair[0]
      var setSongsPage = songsPagePair[1]
      // Artist / album cards. These are lists only — a row opens the shared album
      // view upstream already provides, so no detail state is kept here.
      var browsePhasePair = useState('idle')
      var browsePhase = browsePhasePair[0]
      var setBrowsePhase = browsePhasePair[1]
      var artistsPair = useState([])
      var artistsList = artistsPair[0]
      var setArtistsList = artistsPair[1]
      var albumsPair = useState([])
      var albumsList = albumsPair[0]
      var setAlbumsList = albumsPair[1]
      var artistDetailPair = useState(null)
      var artistDetail = artistDetailPair[0]
      var setArtistDetail = artistDetailPair[1]
      var artistAlbumsPair = useState([])
      var artistAlbumsList = artistAlbumsPair[0]
      var setArtistAlbumsList = artistAlbumsPair[1]
      var browseIdPair = useState('')
      var browseId = browseIdPair[0]
      var setBrowseId = browseIdPair[1]
      var prefs = usePrefs()
      var selection = useStore(selectionStore)
      var selecting = selection.active === true
      var selectedSet = useMemo(
        function () {
          var set = {}
          selection.paths.forEach(function (path) {
            set[path] = true
          })
          return set
        },
        [selection.paths],
      )
      var onlineSelectionList = []

      function reloginExpired() {
        void logoutProvider(provider).then(function () {
          // Navidrome signs in with a URL + credentials, not a QR code, so it must
          // reopen the credential dialog; the QR sheet would show an empty code the
          // user cannot scan and leave them stuck.
          var layer = provider === 'navidrome' ? 'navidrome' : 'login'
          pushLayer(layer, layer === 'navidrome' ? {} : { provider: provider, mode: 'qq' })
        })
      }
      var currentEntries = []
      var likedSet = online.liked || {}

      function toggleOnlineFavorite(track) {
        var path = track.path
        var next = likedSet[path] !== true
        postJson(API + 'online/like', { provider: track.onlineProvider, song: track, on: next })
          .then(function () {
            var map = Object.assign({}, onlineStore.get().liked)
            if (next) map[path] = true
            else delete map[path]
            onlineStore.set({ liked: map })
            refreshLikedPlaylist(next ? 1 : -1)
            showToast(next ? t('page.favorite') : t('page.unfavorite'))
          })
          .catch(function (error) {
            showToast(errorText(error))
          })
      }

      useEffect(
        function () {
          var cancelled = false
          getJson(API + 'online/liked-ids?provider=' + encodeURIComponent(provider))
            .then(function (body) {
              if (cancelled) return
              var map = {}
              ;(Array.isArray(body.ids) ? body.ids : []).forEach(function (path) {
                map[path] = true
              })
              onlineStore.set({ liked: map })
            })
            .catch(function () {
              // Not signed in: every heart stays neutral.
            })
          return function () {
            cancelled = true
          }
        },
        [provider, (online.providers[provider] || {}).loggedIn],
      )
      var playAll = null

      function sortOnlineTracks(entries) {
        return sortTracks((entries || []).map(onlineTrackOf), prefs.sortBy, prefs.sortDir)
      }

      function playSelectedOnline() {
        var picked = {}
        selection.paths.forEach(function (path) {
          picked[path] = true
        })
        var chosen = (currentEntries || []).filter(function (entry) {
          return picked['online:' + (entry.provider || provider) + ':' + entry.id] === true
        })
        if (chosen.length > 0) {
          playOnlineResults(chosen, 0)
          return
        }
        var tracks = onlineSelectionList.filter(function (track) {
          return picked[track.path] === true
        })
        if (tracks.length > 0) player.playList(tracks, 0)
      }

      function sortOnlineEntries(entries) {
        var list = entries || []
        var byPath = {}
        list.forEach(function (entry) {
          byPath['online:' + (entry.provider || provider) + ':' + entry.id] = entry
        })
        return sortOnlineTracks(list)
          .map(function (track) {
            return byPath[track.path]
          })
          .filter(Boolean)
      }

      function setPlayAll(entries) {
        currentEntries = sortOnlineEntries(entries)
        playAll = currentEntries.length > 0
          ? function () {
              playOnlineResults(currentEntries, 0)
            }
          : null
      }

      useEffect(
        function () {
          if (online.playlistsPhase === 'idle' || online.playlistsProvider !== provider) {
            void loadMyPlaylists(provider)
          }
        },
        [provider, online.playlistsPhase, online.playlistsProvider],
      )

      useEffect(
        function () {
          if (nav !== 'cache') {
            setCachePhase('idle')
            return undefined
          }
          var cancelled = false
          setCachePhase('loading')
          getJson(API + 'online/cache/list?provider=' + encodeURIComponent(provider))
            .then(function (body) {
              if (cancelled) return
              setCacheList(Array.isArray(body.songs) ? body.songs : [])
              setCachePhase('ready')
            })
            .catch(function () {
              if (cancelled) return
              setCacheList([])
              setCachePhase('error')
            })
          return function () {
            cancelled = true
          }
        },
        [nav, provider],
      )

      useEffect(
        function () {
          if (nav !== 'songs') {
            setSongsPhase('idle')
            return undefined
          }
          var cancelled = false
          setSongsPhase('loading')
          // Native mode orders on the server and returns one page at a time, so a
          // page is addressed purely by its offset and never appended to.
          var sort = String(prefs.sortBy || 'title')
          var order = prefs.sortDir === 'desc' ? 'desc' : 'asc'
          var offset = (songsPage - 1) * SONG_PAGE_SIZE
          getJson(
            API +
              'online/songs?provider=' +
              encodeURIComponent(provider) +
              '&size=' +
              String(SONG_PAGE_SIZE) +
              '&offset=' +
              String(offset) +
              '&sort=' +
              encodeURIComponent(sort) +
              '&order=' +
              encodeURIComponent(order),
          )
            .then(function (body) {
              if (cancelled) return
              setSongsList(Array.isArray(body.songs) ? body.songs : [])
              setSongsNative(body.native === true)
              setSongsTotal(Number(body.total) || 0)
              setSongsPhase('ready')
            })
            .catch(function () {
              if (cancelled) return
              setSongsList([])
              setSongsNative(false)
              setSongsTotal(0)
              setSongsPhase('error')
            })
          return function () {
            cancelled = true
          }
        },
        [nav, provider, prefs.sortBy, prefs.sortDir, songsPage],
      )

      // Any change of provider or ordering invalidates the page number.
      useEffect(
        function () {
          setSongsPage(1)
        },
        [provider, prefs.sortBy, prefs.sortDir],
      )

      function goToSongsPage(page) {
        var next = Math.max(1, Math.floor(Number(page) || 1))
        if (next === songsPage) return
        setSongsPage(next)
      }

      // Artist / album cards load their list once per view; the rows are static
      // until the user re-enters.
      useEffect(
        function () {
          if (nav !== 'artists' && nav !== 'albums' && nav !== 'artist') {
            setBrowsePhase('idle')
            return undefined
          }
          var cancelled = false
          setBrowsePhase('loading')
          var url = ''
          if (nav === 'artists') url = API + 'online/artists?provider=' + encodeURIComponent(provider)
          else if (nav === 'albums') url = API + 'online/albums?provider=' + encodeURIComponent(provider) + '&size=200'
          else url = API + 'online/artist?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(browseId)
          getJson(url)
            .then(function (body) {
              if (cancelled) return
              if (nav === 'artists') setArtistsList(Array.isArray(body.artists) ? body.artists : [])
              else if (nav === 'albums') setAlbumsList(Array.isArray(body.albums) ? body.albums : [])
              else {
                setArtistDetail(body.artist || null)
                setArtistAlbumsList(Array.isArray(body.albums) ? body.albums : [])
              }
              setBrowsePhase('ready')
            })
            .catch(function () {
              if (cancelled) return
              if (nav === 'artists') setArtistsList([])
              else if (nav === 'albums') setAlbumsList([])
              else {
                setArtistDetail(null)
                setArtistAlbumsList([])
              }
              setBrowsePhase('error')
            })
          return function () {
            cancelled = true
          }
        },
        [nav, provider, browseId],
      )

      /** Open one album through the shared album view (upstream's own entry). */
      function openAlbumCard(album) {
        void openOnlineAlbum({
          album: album.name || '',
          albumId: album.id || '',
          artist: album.artist || '',
          onlineProvider: provider,
          coverUrl: '',
          coverArtId: album.coverArtId || '',
        })
      }

      function openArtistCard(artist) {
        setBrowseId(String(artist.id || ''))
        uiStore.set({ nav: 'artist', filter: null, query: '' })
      }

      function openArtist(track, artist) {
        void openOnlineArtist(track, artist)
      }

      var title = t('v2.recent')
      var count = 0
      var actions = null
      var backActions = []
      var body = null
      var resetKey = ''
      var empty = null

      if (showingSearch) {
        title = t('online.searchResults')
        var results = online.results || []
        count = results.length
        resetKey = 'search:' + provider + ':' + online.query

        if (online.phase === 'searching') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('online.searching')))
        } else if (online.phase === 'error') {
          body = h(Empty, { title: t('online.networkError'), hint: online.error, icon: 'info' })
        } else if (results.length === 0) {
          body = h(Empty, { title: t('online.emptyResults'), hint: '', icon: 'search' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(results), (onlineSelectionList = sortOnlineTracks(results))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            cachedOf: function (track) {
              return online.cache[track.onlineId] === true
            },
            onPlay: function (track) {
              var index = results.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(results, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, { playSelected: playSelectedOnline })
            },
            onToggleFavorite: toggleOnlineFavorite,
            onAlbum: function (track) {
              void openOnlineAlbum(track)
            },
            onArtist: openArtist,
            empty: empty,
          })
          if ((online.searchTotal || 0) > results.length) {
            body = h(
              'div',
              { className: 'mp-songs-pane', key: 'search-pane' },
              body,
              h(
                'div',
                { className: 'mp-pager', key: 'pager' },
                h(
                  Button,
                  {
                    icon: 'plus',
                    disabled: online.searchLoadingMore === true,
                    onClick: function () {
                      void searchOnline(online.query, (online.searchPage || 1) + 1, true)
                    },
                  },
                  online.searchLoadingMore === true ? t('online.loadingMore') : t('online.loadMore'),
                ),
              ),
            )
          }
        }
      } else if (nav === 'album') {
        title = online.albumName || t('online.album')
        var albumSongs = Array.isArray(online.albumSongs) ? online.albumSongs : []
        count = albumSongs.length
        resetKey = 'online-album:' + online.albumProvider + ':' + online.albumId + ':' + online.albumName
        actions = [
          h(
            Button,
            {
              key: 'play',
              variant: 'primary',
              icon: 'play',
              onClick: function () {
                playOnlineResults(albumSongs, 0)
              },
            },
            t('page.playAll'),
          ),
        ]
        backActions = [
          h(
            Button,
            {
              key: 'back',
              variant: 'ghost',
              icon: 'chevronLeft',
              onClick: function () {
                closeOnlineAlbum()
                setNav('recent')
              },
            },
            t('v2.back'),
          ),
        ]
        if (online.albumPhase === 'loading') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (online.albumPhase === 'error') {
          body = h(Empty, { title: t('online.albumFailed'), hint: online.albumError, icon: 'disc' })
        } else if (albumSongs.length === 0) {
          body = h(Empty, { title: t('online.emptyResults'), icon: 'disc' })
        } else {
          // A self-hosted server is the one provider whose album endpoint reports a
          // meaningful disc/track sequence (and never reorders on relevance), so its
          // album keeps the server order. The four Chinese platforms behave exactly
          // as before — they still apply the user's sort preference — because
          // changing their output is not this branch's call to make.
          var albumOrder =
            online.albumProvider === 'navidrome'
              ? albumSongs.map(onlineTrackOf)
              : sortOnlineTracks(albumSongs)
          body = h(TrackListBody, {
            items: (setPlayAll(albumSongs), (onlineSelectionList = albumOrder)),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            cachedOf: function (track) {
              return online.cache[track.onlineId] === true
            },
            onPlay: function (track) {
              var index = albumSongs.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(albumSongs, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, { playSelected: playSelectedOnline })
            },
            onToggleFavorite: toggleOnlineFavorite,
            onArtist: openArtist,
          })
        }
      } else if (nav === 'playlists') {
        title = t('online.myPlaylists')
        var playlists = online.playlists || []
        count = playlists.length
        resetKey = 'online-playlists'
        var signedIn = (online.providers[provider] || {}).loggedIn === true
        if (!signedIn && online.playlistsPhase !== 'loading') {
          body = h(
            Empty,
            {
              title: t('v2.loginNeeded'),
              hint: t('online.playlistsHint'),
              icon: 'user',
            },
          )
          actions = [
            h(
              Button,
              {
                key: 'login',
                variant: 'primary',
                icon: 'qr',
                onClick: function () {
                  pushLayer('login', { provider: provider, mode: 'qq' })
                },
              },
              t('online.login'),
            ),
          ]
        } else if (online.playlistsPhase === 'loading') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (online.playlistsPhase === 'error') {
          body = h(Empty, {
            title: t('online.playlistsError'),
            hint: online.error || t('online.authExpiredHint'),
            icon: 'info',
          })
        } else if (playlists.length === 0) {
          body = h(Empty, { title: t('v2.noPlaylists'), icon: 'list' })
        } else {
          body = h(
            ScrollBox,
            { resetKey: resetKey },
            playlists.map(function (playlist) {
              return h(
                'button',
                {
                  key: playlist.id,
                  type: 'button',
                  className: 'mp-srow',
                  onClick: function () {
                    void openOnlinePlaylist(playlist)
                  },
                },
                h(
                  'div',
                  { className: 'mp-srow-cover' },
                  playlist.cover
                    ? h(Cover, { src: onlineCoverSrc({ coverUrl: playlist.cover }), iconSize: 18 })
                    : icon('list', 18),
                ),
                h(
                  'div',
                  { className: 'mp-srow-main' },
                  h('div', { className: 'mp-srow-title' }, playlist.name || ''),
                  h('div', { className: 'mp-srow-sub' }, (playlist.trackCount || 0) + ' · ' + t('v2.songs')),
                ),
                icon('chevronRight', 14),
              )
            }),
          )
        }
      } else if (nav === 'playlist') {
        title = online.playlistName || t('online.myPlaylists')
        var songs = online.playlistSongs || []
        count = songs.length
        resetKey = 'online-playlist:' + online.playlistId
        backActions = [h(Button, { key: 'back', variant: 'ghost', icon: 'chevronLeft', onClick: function () {
                    closeOnlinePlaylist()
                    setNav('recent')
                  } }, t('v2.back'))]
        if (online.playlistPhase === 'loading') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (songs.length === 0) {
          body = h(Empty, { title: t('online.emptyResults'), icon: 'list' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(songs), (onlineSelectionList = sortOnlineTracks(songs))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            cachedOf: function (track) {
              return online.cache[track.onlineId] === true
            },
            onPlay: function (track) {
              var index = songs.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(songs, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, { playSelected: playSelectedOnline })
            },
            onToggleFavorite: toggleOnlineFavorite,
            onAlbum: function (track) {
              void openOnlineAlbum(track)
            },
            onArtist: openArtist,
          })
        }
      } else if (nav === 'artistSongs') {
        var artistTracks = Array.isArray(online.artistSongs) ? online.artistSongs : []
        title = online.artistName || t('v2.artists')
        count = artistTracks.length
        resetKey = 'online-artist-songs:' + online.artistProvider + ':' + online.artistName
        backActions = [
          h(
            Button,
            {
              key: 'back',
              variant: 'ghost',
              icon: 'chevronLeft',
              onClick: function () {
                var from = online.artistFrom || 'recent'
                closeOnlineArtist()
                setNav(from)
              },
            },
            t('v2.back'),
          ),
        ]
        if (online.artistPhase === 'loading') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (online.artistPhase === 'error') {
          body = h(Empty, { title: t('online.networkError'), hint: online.artistError, icon: 'user' })
        } else if (artistTracks.length === 0) {
          body = h(Empty, { title: t('online.emptyResults'), icon: 'user' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(artistTracks), (onlineSelectionList = sortOnlineTracks(artistTracks))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            cachedOf: function (track) {
              return online.cache[track.onlineId] === true
            },
            onPlay: function (track) {
              var index = artistTracks.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(artistTracks, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, { playSelected: playSelectedOnline })
            },
            onToggleFavorite: toggleOnlineFavorite,
            onAlbum: function (track) {
              void openOnlineAlbum(track)
            },
            onArtist: openArtist,
          })
        }
      } else if (nav === 'songs') {
        // Library-wide browse. Subsonic has no stable "all songs" index, so the
        // host returns getRandomSongs: a sample of the library, not a fixed list.
        title = t('v2.songs')
        var allSongs = songsList || []
        count = allSongs.length
        resetKey = 'online-songs:' + provider
        // Only blank the pane for the first page; "load more" keeps the rows on
        // screen while the next page is in flight.
        var firstPage = songsPhase === 'idle' || (songsPhase === 'loading' && allSongs.length === 0)
        if (firstPage) {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (songsPhase === 'error' && allSongs.length === 0) {
          body = h(Empty, { title: t('online.networkError'), icon: 'info' })
        } else if (allSongs.length === 0) {
          body = h(Empty, { title: t('online.allSongsEmpty'), hint: t('online.allSongsEmptyHint'), icon: 'note' })
        } else {
          // Native pages arrive already ordered by the server, so re-sorting them
          // client-side would break the page boundaries; the random sample has no
          // such constraint and keeps honouring the sort preference.
          var songOrder = songsNative === true ? allSongs.map(onlineTrackOf) : sortOnlineTracks(allSongs)
          body = h(TrackListBody, {
            items: (setPlayAll(allSongs), (onlineSelectionList = songOrder)),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            cachedOf: function (track) {
              return online.cache[track.onlineId] === true
            },
            onPlay: function (track) {
              var index = allSongs.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(allSongs, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, { playSelected: playSelectedOnline })
            },
            onToggleFavorite: toggleOnlineFavorite,
            onArtist: openArtist,
            empty: empty,
          })
          // A real footer: the list keeps flex:1 and the pager sits below it, so
          // it stays visible without scrolling to the end of 3000 rows.
          var footer = null
          if (songsNative === true) {
            var pageCount = Math.max(1, Math.ceil(songsTotal / SONG_PAGE_SIZE))
            var numbers = pageWindow(songsPage, pageCount)
            var busy2 = songsPhase === 'loading'
            footer = h(
              'div',
              { className: 'mp-pager', key: 'pager' },
              h(
                Button,
                {
                  key: 'prev',
                  icon: 'chevronLeft',
                  disabled: busy2 || songsPage <= 1,
                  onClick: function () {
                    goToSongsPage(songsPage - 1)
                  },
                },
                '',
              ),
              numbers.map(function (number, index) {
                if (number === null) {
                  return h('span', { key: 'gap' + index, className: 'mp-page-gap' }, '…')
                }
                return h(
                  'button',
                  {
                    key: 'p' + number,
                    type: 'button',
                    className: 'mp-page-num' + (number === songsPage ? ' is-on' : ''),
                    disabled: busy2,
                    onClick: function () {
                      goToSongsPage(number)
                    },
                  },
                  String(number),
                )
              }),
              h(
                Button,
                {
                  key: 'next',
                  icon: 'chevronRight',
                  disabled: busy2 || songsPage >= pageCount,
                  onClick: function () {
                    goToSongsPage(songsPage + 1)
                  },
                },
                '',
              ),
              h(
                'span',
                { className: 'mp-loaded-of' },
                t('online.pageOf', { page: songsPage, pages: pageCount, total: songsTotal }),
              ),
            )
          } else if (provider === 'navidrome') {
            // Explain why there is no pager instead of leaving a silent cap.
            footer = h(
              'div',
              { className: 'mp-pager is-hint', key: 'pager' },
              h('span', { className: 'mp-loaded-of' }, t('online.randomSample', { n: allSongs.length })),
              h(
                Button,
                {
                  icon: 'settings',
                  onClick: function () {
                    pushLayer('navidrome')
                  },
                },
                t('online.enableFullLibrary'),
              ),
            )
          }
          if (footer !== null) {
            body = h('div', { className: 'mp-songs-pane', key: 'songs-pane' }, body, footer)
          }
        }
      } else if (nav === 'artists' || nav === 'albums' || nav === 'artist') {
        // Card grids. Every row opens the shared album view, so these are purely
        // navigation surfaces over the provider's own catalogue.
        var isArtistList = nav === 'artists'
        var isAlbumList = nav === 'albums'
        var cards = isArtistList ? artistsList : isAlbumList ? albumsList : artistAlbumsList
        title = isArtistList
          ? t('v2.artists')
          : isAlbumList
            ? t('v2.albums')
            : (artistDetail && artistDetail.name) || t('v2.artists')
        count = cards.length
        resetKey = 'online-' + nav + ':' + provider + (nav === 'artist' ? ':' + browseId : '')
        if (browsePhase === 'loading' || browsePhase === 'idle') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (browsePhase === 'error') {
          body = h(Empty, { title: t('online.networkError'), icon: 'info' })
        } else if (cards.length === 0) {
          body = h(Empty, { title: t('page.noResults'), icon: isArtistList ? 'user' : 'disc' })
        } else {
          var openCard = isArtistList
            ? openArtistCard
            : function (card) {
                openAlbumCard(card)
              }
          body = h(
            ScrollBox,
            { resetKey: resetKey },
            h(
              'div',
              { className: 'mp-card-grid' },
              cards.map(function (card) {
                var cover = subsonicCoverUrl(card.coverArtId)
                return h(
                  'button',
                  {
                    key: card.id,
                    type: 'button',
                    className: 'mp-card' + (isArtistList ? ' is-round' : ''),
                    onClick: function () {
                      openCard(card)
                    },
                  },
                  h(
                    'div',
                    { className: 'mp-card-art' },
                    cover === ''
                      ? h('span', { className: 'mp-card-art-fallback' }, icon(isArtistList ? 'user' : 'disc', 22))
                      : h(Cover, { src: cover, iconSize: 22 }),
                  ),
                  h('div', { className: 'mp-card-title', title: card.name }, card.name || t('page.unknownAlbum')),
                  h(
                    'div',
                    { className: 'mp-card-sub' },
                    isArtistList
                      ? t('online.albumCount', { n: card.albumCount })
                      : isAlbumList
                        ? (card.artist || '') + (card.songCount > 0 ? ' · ' + t('page.trackCountUnit', { n: card.songCount }) : '')
                        : t('page.trackCountUnit', { n: card.songCount }),
                  ),
                )
              }),
            ),
          )
        }
      } else if (nav === 'cache') {
        title = t('v2.cache')
        var entries = cacheList || []
        count = entries.length
        resetKey = 'online-cache'
        if (cachePhase === 'loading') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (entries.length === 0) {
          body = h(Empty, { title: t('online.cacheEmpty'), icon: 'download' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(entries), (onlineSelectionList = sortOnlineTracks(entries))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            onToggleFavorite: toggleOnlineFavorite,
            onAlbum: function (track) {
              void openOnlineAlbum(track)
            },
            onArtist: openArtist,
            cachedOf: function () {
              return true
            },
            onPlay: function (track) {
              var index = entries.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(entries, index < 0 ? 0 : index)
            },
          })
        }
      } else {
        var history = onlineEntriesForHistory(online, provider)
        title = t('v2.recent')
        count = history.length
        resetKey = 'online-recent:' + provider

        if (history.length === 0) {
          body = h(Empty, { title: t('v2.noHistory'), hint: t('v2.noHistoryHint'), icon: 'clock' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(history), (onlineSelectionList = sortOnlineTracks(history))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            onPlay: function (track) {
              var index = history.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(history, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, {
                playSelected: playSelectedOnline,
                onRemove: function () {
                  var match = /^online:([^:]+):(.+)$/.exec(track.path)
                  if (match === null) return
                  removeHistory({ provider: match[1], id: match[2] })
                  showToast(t('online.removedFromHistory'))
                },
              })
            },
            onToggleFavorite: toggleOnlineFavorite,
            onAlbum: function (track) {
              void openOnlineAlbum(track)
            },
            onArtist: openArtist,
          })
        }
      }

      return [
        h(ContentHeader, {
          key: 'head',
          title: title,
          count: count,
          onAll: function () {
            selectAllIn(onlineSelectionList)
          },
          onNone: function () {
            setSelectionMode(false)
          },
          onRange: beginRangePick,
          onInvert: function () {
            invertSelectionIn(onlineSelectionList)
          },
          selecting: selecting,
          selectedCount: selection.paths.length,
        }),
        online.authExpired === provider
          ? h(
              'div',
              { className: 'mp-online-auth', key: 'auth', role: 'status' },
              h('span', { className: 'mp-online-auth-icon' }, icon('info', 16)),
              h(
                'div',
                { className: 'mp-online-auth-text' },
                h('div', { className: 'mp-online-auth-title' }, t('online.authExpired')),
                h('div', { className: 'mp-online-auth-hint' }, t('online.authExpiredHint')),
              ),
              h(
                'div',
                { className: 'mp-online-auth-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-online-auth-btn',
                    onClick: function () {
                      void loadMyPlaylists(provider)
                    },
                  },
                  t('online.retry'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-online-auth-btn is-primary',
                    onClick: reloginExpired,
                  },
                  t('online.relogin'),
                ),
              ),
            )
          : null,
        backActions.length > 0 || (actions && actions.length > 0)
          ? h(
              'div',
              { className: 'mp-toolbar', key: 'toolbar' },
              h('div', { className: 'mp-toolbar-left' }, backActions),
              actions && actions.length > 0
                ? h('div', { className: 'mp-toolbar-right' }, actions)
                : null,
            )
          : null,
        h('div', { className: 'mp-content-body', key: 'body', style: { display: 'contents' } }, body),
      ]
    }

    // ── src/ui/10-navigation.js
    /**
     * navigation: one model, two shapes (top section bar or left rail).
     *
     * Both shapes render `navGroupsFor`, so switching the layout never changes
     * what is reachable — only where it sits. Playlists are first-class items,
     * not a "playlists" list page.
     */

    function navItemContextMenu(item, active) {
      if (!item.localPlaylistId) return undefined
      return function (event) {
        event.preventDefault()
        var id = item.localPlaylistId
        var name = item.label
        pushLayer('confirm', {
          title: t('page.delete'),
          text: t('page.deleteConfirm', { name: name }),
          onConfirm: function () {
            if (active === item.key) setNav('songs')
            void removePlaylist(id)
          },
        })
      }
    }

    function NavRail(props) {
      var groups = navGroupsFor(props.source, props.favoritesCount)
      var active = activeNavKey(props.nav)
      return h(
        'nav',
        { className: 'mp-nav', 'aria-label': t('page.tabLocal') },
        groups.map(function (group) {
          return h(
            'div',
            { className: 'mp-nav-group', key: group.label },
            h(
              'div',
              { className: 'mp-nav-head' },
              h('div', { className: 'mp-nav-label' }, group.label),
              group.action
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'mp-nav-act',
                      title: group.action.title,
                      'aria-label': group.action.title,
                      onClick: group.action.run,
                    },
                    icon(group.action.icon, 12),
                  )
                : null,
            ),
            group.items.map(function (item) {
              return h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  className: cx('mp-nav-item', active === item.key && 'is-on'),
                  'aria-current': active === item.key ? 'page' : undefined,
                  title: item.label,
                  onClick: function () {
                    activateNavItem(item)
                  },
                  onContextMenu: navItemContextMenu(item, active),
                  onMouseEnter: item.onlinePlaylist
                    ? function () {
                        prefetchOnlinePlaylist(item.onlinePlaylist)
                      }
                    : undefined,
                  onFocus: item.onlinePlaylist
                    ? function () {
                        prefetchOnlinePlaylist(item.onlinePlaylist)
                      }
                    : undefined,
                },
                icon(item.icon, 15),
                h('span', null, item.label),
                item.count !== null && item.count !== undefined
                  ? h('em', { className: 'mp-nav-count' }, String(item.count))
                  : null,
              )
            }),
          )
        }),
      )
    }

    var MAX_PLAYLIST_TABS = 3

    function SectionPlaylistOverflow(props) {
      var openPair = useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      var buttonRef = useRef(null)
      var posPair = useState(null)
      var pos = posPair[0]
      var setPos = posPair[1]
      var active = activeNavKey(uiStore.get().nav)

      useEffect(
        function () {
          if (!open) return undefined
          function place() {
            var button = buttonRef.current
            if (!button) return
            var rect = button.getBoundingClientRect()
            var width = Math.min(720, window.innerWidth - 24)
            var left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width))
            setPos({ left: left + 'px', top: rect.bottom + 8 + 'px', width: width + 'px' })
          }
          function close(event) {
            if (buttonRef.current && buttonRef.current.contains(event.target)) return
            var pop = document.querySelector('.mp-playlist-pop')
            if (pop && pop.contains(event.target)) return
            setOpen(false)
          }
          function onKey(event) {
            if (event.key === 'Escape') setOpen(false)
          }
          place()
          window.addEventListener('resize', place)
          window.addEventListener('scroll', place, true)
          document.addEventListener('pointerdown', close, true)
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', place, true)
            document.removeEventListener('pointerdown', close, true)
            window.removeEventListener('keydown', onKey)
          }
        },
        [open],
      )

      function pick(item) {
        setOpen(false)
        activateNavItem(item)
      }

      return h(
        'span',
        { className: 'mp-sec-overflow' },
        h(
          'button',
          {
            type: 'button',
            ref: buttonRef,
            className: cx('mp-sec-expand', open && 'is-on'),
            title: t('v2.expandPlaylists'),
            'aria-expanded': open === true,
            onClick: function () {
              setOpen(!open)
            },
          },
          t('v2.expandPlaylists'),
          icon('chevronDown', 12),
        ),
        open
          ? h(
              'div',
              {
                className: 'mp-playlist-pop',
                role: 'dialog',
                'aria-label': t('v2.playlists'),
                style: pos || { visibility: 'hidden' },
              },
              h(
                'div',
                { className: 'mp-playlist-pop-head' },
                h('strong', null, t('v2.playlists')),
                h('span', { className: 'mp-playlist-pop-count' }, String(props.items.length)),
              ),
              h(
                'div',
                { className: 'mp-playlist-grid' },
                props.items.map(function (item) {
                  return h(
                    'button',
                    {
                      key: item.key,
                      type: 'button',
                      className: cx('mp-playlist-card', active === item.key && 'is-on'),
                      onClick: function () {
                        pick(item)
                      },
                      onContextMenu: navItemContextMenu(item, active),
                    },
                    h(
                      'span',
                      { className: 'mp-playlist-card-icon' },
                      item.coverSrc ? h(Cover, { src: item.coverSrc, iconSize: 16 }) : icon(item.icon || 'list', 16),
                    ),
                    h(
                      'span',
                      { className: 'mp-playlist-card-main' },
                      h('strong', null, item.label),
                      h(
                        'span',
                        null,
                        item.count !== null && item.count !== undefined
                          ? t('page.trackCountUnit', { n: item.count })
                          : '',
                      ),
                    ),
                  )
                }),
              ),
            )
          : null,
      )
    }

    function SectionBar(props) {
      var groups = navGroupsFor(props.source, props.favoritesCount)
      var active = activeNavKey(props.nav)
      return h(
        'div',
        { className: 'mp-sectionbar', role: 'tablist', 'aria-label': t('page.tabLocal') },
        groups.map(function (group, groupIndex) {
          return h(
            'span',
            { key: group.label, style: { display: 'contents' } },
            groupIndex > 0 ? h('span', { className: 'mp-sec-sep' }) : null,
            group.showLabel ? h('span', { className: 'mp-sec-label' }, group.label) : null,
            group.action
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-sec-act',
                    title: group.action.title,
                    'aria-label': group.action.title,
                    onClick: group.action.run,
                  },
                  icon(group.action.icon, 12),
                )
              : null,
            (group.label === t('v2.playlists') && group.items.length > MAX_PLAYLIST_TABS
              ? group.items.slice(0, MAX_PLAYLIST_TABS)
              : group.items
            ).map(function (item) {
              return h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  role: 'tab',
                  title: item.label,
                  'aria-selected': active === item.key,
                  className: cx('mp-sec-item', active === item.key && 'is-on'),
                  onClick: function () {
                    activateNavItem(item)
                  },
                  onContextMenu: navItemContextMenu(item, active),
                  onMouseEnter: item.onlinePlaylist
                    ? function () {
                        prefetchOnlinePlaylist(item.onlinePlaylist)
                      }
                    : undefined,
                  onFocus: item.onlinePlaylist
                    ? function () {
                        prefetchOnlinePlaylist(item.onlinePlaylist)
                      }
                    : undefined,
                },
                item.label,
                item.count !== null && item.count !== undefined
                  ? h('span', { className: 'mp-sec-count' }, String(item.count))
                  : null,
              )
            }),
            group.label === t('v2.playlists') && group.items.length > MAX_PLAYLIST_TABS
              ? h(SectionPlaylistOverflow, { items: group.items })
              : null,
          )
        }),
      )
    }

    // ── src/ui/11-panel.js
    /**
     * panel: the single composition point (top bar, workspace, player bar, layers).
     */

    class MusicBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch() {
        // A broken render must never take the host UI down with it.
      }

      render() {
        if (this.state.failed) return null
        return this.props.children
      }
    }

    class SilentBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch() {}

      render() {
        if (this.state.failed) return null
        return this.props.children
      }
    }

    function TopBar(props) {
      var ui = props.ui
      var online = props.online
      var inputRef = useRef(null)
      var textPair = useState(ui.source === 'local' ? ui.query : '')
      var text = textPair[0]
      var setText = textPair[1]

      useEffect(
        function () {
          setText(ui.source === 'local' ? ui.query : '')
        },
        [ui.source],
      )

      useEffect(
        function () {
          function onKey(event) {
            var tag = event.target && event.target.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (event.key === '/') {
              event.preventDefault()
              if (inputRef.current) inputRef.current.focus()
            }
          }
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('keydown', onKey)
          }
        },
        [],
      )

      function submit() {
        if (isOnlineSource(ui.source)) {
          void searchOnline(text)
        }
      }

      var providerInfo = isOnlineSource(ui.source) ? (online.providers[ui.source] || {}) : null

      return h(
        'header',
        { className: 'mp-topbar' },
        h(
          'div',
          { className: 'mp-brand' },
          h(
            'a',
            {
              className: 'mp-brand-link',
              href: 'https://github.com/Aliboder/dsh-music-panel',
              target: '_blank',
              rel: 'noopener noreferrer',
              title: 'GitHub',
              'aria-label': 'GitHub',
            },
            h('span', { className: 'mp-brand-dot' }, h('img', { className: 'mp-brand-logo', src: BRAND_LOGO, alt: '' })),
          ),
          t('nav.label'),
        ),
        h(
          'div',
          { className: 'mp-src-tabs', role: 'tablist' },
          [
            ['local', t('page.tabLocal')],
            ['netease', t('online.providerNetease')],
            ['qq', t('online.providerQq')],
            ['kugou', t('online.providerKugou')],
            ['kugouLite', t('online.providerKugouLite')],
            ['navidrome', t('online.providerNavidrome')],
          ].map(function (entry) {
            return h(
              'button',
              {
                key: entry[0],
                type: 'button',
                role: 'tab',
                'aria-selected': ui.source === entry[0],
                className: cx('mp-src-tab', ui.source === entry[0] && 'is-on'),
                onClick: function () {
                  setSource(entry[0])
                },
              },
              entry[1],
            )
          }),
        ),
        h(
          'div',
          { className: 'mp-search' },
          icon('search', 14),
          h('input', {
            ref: inputRef,
            className: 'mp-search-input',
            type: 'search',
            value: text,
            placeholder: isOnlineSource(ui.source) ? t('online.searchPlaceholder') : t('page.searchPlaceholder'),
            onChange: function (event) {
              var value = event.target.value
              setText(value)
              if (!isOnlineSource(ui.source)) {
                setUi({ query: value })
              } else if (value === '') {
                onlineStore.set({ query: '', results: [], phase: 'idle', error: '' })
              }
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') submit()
            },
          }),
        ),
        providerInfo !== null
          ? h(
              'div',
              { className: 'mp-userchip is-on' },
              h('span', { className: 'mp-userchip-dot' }),
              h('span', { className: 'mp-userchip-name' }, providerInfo.loggedIn ? providerInfo.nickname || t('online.loggedIn') : t('online.loggedOut')),
              providerInfo.loggedIn && providerInfo.vip === true
                ? h('span', { className: 'mp-userchip-vip is-on', title: 'VIP' }, 'VIP')
                : null,
              providerInfo.loggedIn
                ? h(
                    'span',
                    {
                      className: 'mp-userchip-out',
                      role: 'button',
                      tabIndex: 0,
                      onClick: function () {
                        void logoutProvider(ui.source)
                      },
                    },
                    t('online.logout'),
                  )
                : h(
                    'span',
                    {
                      className: 'mp-userchip-out',
                      role: 'button',
                      tabIndex: 0,
                      onClick: function () {
                        // Navidrome has no QR flow: open the credential dialog
                        // directly instead of the shared sign-in sheet.
                        if (ui.source === 'navidrome') {
                          pushLayer('navidrome')
                          return
                        }
                        pushLayer('login', { provider: ui.source, mode: 'qq' })
                      },
                    },
                    ui.source === 'navidrome' ? t('online.navidromeConnect') : t('online.login'),
                  ),
            )
          : null,
        h(IconButton, {
          icon: 'refresh',
          title: t('page.refresh'),
          onClick: function () {
            if (isOnlineSource(ui.source)) {
              void loadProviders()
              void loadMyPlaylists(ui.source)
              showToast(t('online.refresh'))
            } else {
              void loadLibrary(true)
              showToast(t('page.scanning'))
            }
          },
        }),
        h(IconButton, {
          icon: 'settings',
          title: t('page.settings'),
          onClick: function () {
            pushLayer('settings')
          },
        }),
      )
    }

    function ContentArea(props) {
      var ui = props.ui
      useEffect(
        function () {
          if (ui.source === 'local' && ui.nav === 'stats') {
            void loadStats((props.library && props.library.statsRange) || 'all')
          }
        },
        [ui.source, ui.nav],
      )
      if (isOnlineSource(ui.source)) return h(OnlineContent, props)
      return h(LocalContent, props)
    }

    function AudioHost() {
      var ref = useRef(null)
      useEffect(function () {
        player.attachAudio(ref.current)
        player.tryRestore()
        return function () {
          player.attachAudio(null)
        }
      }, [])
      return h('audio', { ref: ref, className: 'mp-audio-host', preload: 'metadata', 'aria-hidden': 'true' })
    }

    function applyControlAction(action) {
      if (!action || typeof action.action !== 'string') return
      if (action.action === 'pause') {
        player.pause()
        return
      }
      if (action.action === 'next') {
        player.next()
        return
      }
      if (action.action === 'previous' || action.action === 'prev') {
        player.prev()
        return
      }
      if (action.action !== 'play') return
      var query = String(action.query || '').trim()
      if (query === '') return
      // Must list every provider the tool advertises, or a request for that source
      // silently degrades to a local library search (wrong track, or none at all).
      var source = isOnlineSource(action.source) ? action.source : 'local'
      if (source === 'local') {
        var tracks = libraryStore.get().tracks
        var needle = query.toLowerCase()
        var hit = null
        for (var i = 0; i < tracks.length; i += 1) {
          var hay = (String(tracks[i].title || '') + ' ' + String(tracks[i].artist || '')).toLowerCase()
          if (hay.indexOf(needle) >= 0) {
            hit = tracks[i]
            break
          }
        }
        if (hit !== null) player.playList([hit], 0)
        return
      }
      getJson(API + 'online/search?provider=' + encodeURIComponent(source) + '&q=' + encodeURIComponent(query))
        .then(function (body) {
          var results = Array.isArray(body.results) ? body.results : []
          if (results.length > 0) playOnlineResults(results, 0)
        })
        .catch(function () {
          // The model action is best effort.
        })
    }

    function OverlayRoot() {
      var overlay = useStore(overlayStore)
      var layers = overlay.layers || []
      return layers.map(function (layer) {
        if (layer.kind === 'menu') return h(ContextMenu, { key: 'menu', layer: layer })
        if (layer.kind === 'login') return h(LoginDialog, { key: 'login', layer: layer })
        if (layer.kind === 'tag') return h(TagDialog, { key: 'tag', layer: layer })
        if (layer.kind === 'addTo') return h(AddToPlaylistDialog, { key: 'addTo', layer: layer })
        if (layer.kind === 'batchEdit') return h(BatchEditDialog, { key: 'batchEdit', layer: layer })
        if (layer.kind === 'duplicates') return h(DuplicatesDialog, { key: 'duplicates', layer: layer })
        if (layer.kind === 'onlineLyric') return h(OnlineLyricDialog, { key: 'onlineLyric', layer: layer })
        if (layer.kind === 'trash') return h(TrashDialog, { key: 'trash', layer: layer })
        if (layer.kind === 'confirm') return h(ConfirmDialog, { key: 'confirm', layer: layer })
        if (layer.kind === 'newPlaylist') return h(NewPlaylistDialog, { key: 'newPlaylist', layer: layer })
        if (layer.kind === 'folderPicker') return h(FolderPickerDialog, { key: 'folderPicker', layer: layer })
        if (layer.kind === 'onlineAddTo') return h(OnlineAddToDialog, { key: 'onlineAddTo', layer: layer })
        if (layer.kind === 'navidrome') return h(NavidromeDialog, { key: 'navidrome', layer: layer })
        if (layer.kind === 'settings') {
          return h(SettingsSheet, {
            key: 'settings',
            open: true,
            onClose: function () {
              removeLayer('settings')
            },
          })
        }
        return null
      })
    }

    var BRAND_LOGO = 'data:image/webp;base64,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'

    var STARTUP_GUIDE_KEY = 'music.startupGuide.intro.v1'
    var startupGuideShownThisSession = false

    function startupGuideDisabled() {
      try {
        return window.localStorage.getItem(STARTUP_GUIDE_KEY) === '1'
      } catch (error) {
        return false
      }
    }

    function startupGuideOpen() {
      if (startupGuideShownThisSession) return false
      if (startupGuideDisabled()) return false
      startupGuideShownThisSession = true
      return true
    }

    function dismissStartupGuide(disable) {
      startupGuideShownThisSession = true
      try {
        if (disable === true) window.localStorage.setItem(STARTUP_GUIDE_KEY, '1')
        else window.localStorage.removeItem(STARTUP_GUIDE_KEY)
      } catch (error) {
        // Best effort only; if storage is unavailable the guide may show again.
      }
    }

    function StartupGuide(props) {
      var countPair = useState(3)
      var countdown = countPair[0]
      var setCountdown = countPair[1]
      var dontPair = useState(false)
      var dontShow = dontPair[0]
      var setDontShow = dontPair[1]
      var dontShowRef = useRef(false)
      var prefs = usePrefs()
      var coverStyle = prefs.coverStyle === 'vinyl' ? 'vinyl' : 'square'

      function changeDontShow(next) {
        dontShowRef.current = next
        setDontShow(next)
      }

      useEffect(
        function () {
          if (props.open !== true) return undefined
          setCountdown(3)
          changeDontShow(false)
          var timer = setInterval(function () {
            setCountdown(function (value) {
              return value > 0 ? value - 1 : 0
            })
          }, 1000)
          return function () {
            clearInterval(timer)
          }
        },
        [props.open],
      )

      useEffect(
        function () {
          if (props.open !== true || countdown <= 0) return undefined
          function blockEscape(event) {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
          }
          window.addEventListener('keydown', blockEscape, true)
          return function () {
            window.removeEventListener('keydown', blockEscape, true)
          }
        },
        [props.open, countdown],
      )

      if (props.open !== true) return null

      function finish() {
        if (countdown > 0) return
        props.onClose(dontShowRef.current)
      }

      function chooseCoverStyle(style) {
        setPrefs({
          coverStyle: style,
          circularCover: style === 'vinyl',
          vinylRing: style === 'vinyl',
          coverSpin: style === 'vinyl',
        })
      }

      var features = [
        {
          key: 'online',
          icon: 'note',
          accent: 'var(--dsw-alias-state-business-primary,#7aaaff)',
          title: t('guide.featureLocalTitle'),
          desc: t('guide.featureLocalDesc'),
        },
        {
          key: 'player',
          icon: 'maximize',
          accent: 'var(--dsw-alias-state-done-primary,#a78bfa)',
          title: t('guide.featurePlayerTitle'),
          desc: t('guide.featurePlayerDesc'),
        },
        {
          key: 'composer',
          icon: 'translate',
          accent: 'var(--dsw-alias-state-success-primary,#22c55e)',
          title: t('guide.featureComposerTitle'),
          desc: t('guide.featureComposerDesc'),
        },
        {
          key: 'library',
          icon: 'playlist',
          accent: 'var(--dsw-alias-state-warn-primary,#f59e0b)',
          title: t('guide.featureLibraryTitle'),
          desc: t('guide.featureLibraryDesc'),
        },
      ]
      var progress = Math.round(((3 - countdown) / 3) * 100)

      function styleOption(style, label) {
        var on = coverStyle === style
        return h(
          'button',
          {
            type: 'button',
            className: cx('mp-guide-style-option', on && 'is-on'),
            'aria-pressed': on,
            onClick: function () {
              chooseCoverStyle(style)
            },
          },
          h(
            'span',
            { className: cx('mp-guide-style-thumb', style === 'vinyl' ? 'is-vinyl' : 'is-square') },
            h('img', { src: BRAND_LOGO, alt: '' }),
          ),
          h('span', { className: 'mp-guide-style-name' }, label),
          on ? h('span', { className: 'mp-guide-style-check' }, icon('check', 12)) : null,
        )
      }

      return h(
        KitModal,
        { headless: true, onClose: countdown > 0 ? undefined : finish, className: 'mp-guide-modal' },
        h(
          'div',
          {
            className: 'mp-guide-panel',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('guide.title'),
          },
          countdown > 0
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  className: 'mp-guide-close',
                  title: t('v2.close'),
                  'aria-label': t('v2.close'),
                  onClick: finish,
                },
                icon('x', 16),
              ),
          h(
            'div',
            { className: cx('mp-guide-visual', coverStyle === 'vinyl' ? 'is-vinyl' : 'is-square') },
            h('div', { className: 'mp-guide-watermark', 'aria-hidden': 'true' }, 'MUSIC'),
            h(
              'div',
              { className: 'mp-guide-shot' },
              h('img', {
                src: coverStyle === 'vinyl' ? GUIDE_SHOT_VINYL : GUIDE_SHOT_SQUARE,
                alt: '',
              }),
            ),
          ),
          h(
            'div',
            { className: 'mp-guide-content' },
            h(
              'div',
              { className: 'mp-guide-scroll' },
              h('div', { className: 'mp-guide-eyebrow' }, 'DSH · MUSIC PLAYER'),
              h('div', { className: 'mp-guide-title' }, t('guide.title')),
              h('div', { className: 'mp-guide-tagline' }, t('guide.lead')),
              h(
                'div',
                { className: 'mp-guide-list' },
                features.map(function (feature, index) {
                  return h(
                    'div',
                    {
                      key: feature.key,
                      className: 'mp-guide-row',
                      style: { '--mp-guide-accent': feature.accent },
                    },
                    h('span', { className: 'mp-guide-row-icon' }, icon(feature.icon, 15)),
                    h(
                      'div',
                      { className: 'mp-guide-row-main' },
                      h('div', { className: 'mp-guide-row-title' }, feature.title),
                      h('div', { className: 'mp-guide-row-desc' }, feature.desc),
                    ),
                    h('span', { className: 'mp-guide-row-index' }, String(index + 1).padStart(2, '0')),
                  )
                }),
              ),
              h(
                'div',
                { className: 'mp-guide-style' },
                h(
                  'div',
                  { className: 'mp-guide-style-head' },
                  h('span', null, t('guide.styleTitle')),
                  h('span', { className: 'mp-guide-style-hint' }, t('guide.styleHint')),
                ),
                h(
                  'div',
                  { className: 'mp-guide-style-options' },
                  styleOption('square', t('guide.styleSquare')),
                  styleOption('vinyl', t('guide.styleVinyl')),
                ),
              ),
              h(
                'div',
                { className: 'mp-guide-warning-card' },
                icon('info', 15),
                h(
                  'div',
                  null,
                  h('div', { className: 'mp-guide-warning-title' }, t('guide.warningTitle')),
                  h('div', { className: 'mp-guide-warning-text' }, t('guide.warningText')),
                ),
              ),
              h(
                'div',
                { className: 'mp-guide-signature' },
                h('span', null, t('guide.signature')),
                h('span', { className: 'mp-guide-signature-rule' }),
                h('span', null, 'DSH MUSIC'),
              ),
            ),
          ),
          h(
            'div',
            { className: 'mp-guide-footer' },
            h(
              'div',
              { className: 'mp-guide-check' },
              h(Switch, {
                value: dontShow,
                onChange: changeDontShow,
                label: t('guide.dontShow'),
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mp-guide-check-text',
                  onClick: function () {
                    changeDontShow(!dontShowRef.current)
                  },
                },
                t('guide.dontShow'),
              ),
            ),
            h(
              'div',
              { className: 'mp-guide-action' },
              h('div', { className: 'mp-guide-progress' }, h('i', { style: { width: progress + '%' } })),
              h(Button, {
                variant: 'primary',
                disabled: countdown > 0,
                onClick: finish,
                children:
                  countdown > 0 ? t('guide.wait', { seconds: countdown }) : t('guide.start'),
              }),
            ),
          ),
        ),
      )
    }

    function Panel() {
      var ui = useStore(uiStore)
      var library = useStore(libraryStore)
      var online = useStore(onlineStore)
      var prefs = usePrefs()
      var snap = usePlayerSnapshot()
      var guidePair = useState(startupGuideOpen)
      var guideOpen = guidePair[0]
      var setGuideOpen = guidePair[1]
      var locatePair = useState('')
      var locatePath = locatePair[0]
      var setLocatePath = locatePair[1]
      var current = snap.queue[snap.index] || null
      var favorites = useMemo(function () {
        return favoriteSet()
      }, [library.favorites])
      var favoriteCount = library.favorites.length

      useEffect(
        function () {
          var deadline = Number(prefs.sleepDeadline) || 0
          var minutes = Number(prefs.sleepTimerMinutes) || 0
          if (deadline <= 0 && minutes > 0) {
            // Older prefs only stored minutes; turn them into a deadline once.
            setPrefs({ sleepDeadline: Date.now() + minutes * 60000 })
            return undefined
          }
          if (deadline <= 0) return undefined
          var delay = deadline - Date.now()
          if (delay <= 0) {
            player.pause()
            setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
            showToast(t('settings.sleepTimerDone'))
            return undefined
          }
          var timer = setTimeout(function () {
            player.pause()
            setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
            showToast(t('settings.sleepTimerDone'))
          }, delay)
          return function () {
            clearTimeout(timer)
          }
        },
        [prefs.sleepDeadline, prefs.sleepTimerMinutes],
      )

      useEffect(function () {
        void loadLibrary(false)
        void loadFavorites()
        void loadPlaylists()
        void loadConfig()
        void loadProviders()
      }, [])

      useEffect(function () {
        return player.subscribeError(function (info) {
          var reason = info && typeof info.reason === 'string' ? info.reason.trim() : ''
          showToast(reason ? t('page.playbackFailed', { reason: reason }) : t('page.playbackFailedNoReason'))
        })
      }, [])

      useEffect(
        function () {
          if (isOnlineSource(ui.source)) {
            onlineStore.set({ provider: ui.source })
            void loadProviders()
          }
        },
        [ui.source],
      )

      useEffect(function () {
        var timer = setInterval(function () {
          getJson(API + 'control/pending')
            .then(function (body) {
              ;(body.actions || []).forEach(applyControlAction)
            })
            .catch(function () {
              // The queue endpoint is optional.
            })
        }, 2000)
        return function () {
          clearInterval(timer)
        }
      }, [])

      useEffect(
        function () {
          if (current === null || !current.onlineProvider) return undefined
          var provider = current.onlineProvider
          var id = current.onlineId
          var timer = setInterval(function () {
            void refreshCacheStatus(provider, [id])
          }, 3000)
          return function () {
            clearInterval(timer)
          }
        },
        [current ? current.path : ''],
      )

      useEffect(function () {
        function onKey(event) {
          var tag = event.target && event.target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            if (event.key === 'Escape' && event.target.blur) event.target.blur()
            return
          }
          if (event.key === 'Escape') {
            if (typeof document !== 'undefined') {
              var hostModal = document.querySelector('[role="dialog"][aria-modal="true"]')
              if (hostModal !== null && hostModal.closest('.mp-root') === null) return
            }
            if (isRangePicking()) {
              cancelRangePick()
              return
            }
            if (popLayer()) return
            if (selectionStore.get().active === true) {
              setSelectionMode(false)
              return
            }
            if (uiStore.get().queueOpen) {
              uiStore.set({ queueOpen: false })
              return
            }
            if (uiStore.get().npOpen) uiStore.set({ npOpen: false })
            return
          }
          if (event.code === 'Space') {
            event.preventDefault()
            player.toggle()
            return
          }
          if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowRight') {
            event.preventDefault()
            player.next()
            return
          }
          if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowLeft') {
            event.preventDefault()
            player.prev()
          }
        }
        window.addEventListener('keydown', onKey)
        return function () {
          window.removeEventListener('keydown', onKey)
        }
      }, [])

      function openTrackMenu(track, event, extra) {
        pushLayer('menu', {
          track: track,
          x: event ? event.clientX : 20,
          y: event ? event.clientY : 20,
          visiblePaths: extra && Array.isArray(extra.visiblePaths) ? extra.visiblePaths : null,
          playSelected: extra && typeof extra.playSelected === 'function' ? extra.playSelected : null,
          onRemove: extra && typeof extra.onRemove === 'function' ? extra.onRemove : null,
        })
      }

      function locateCurrent() {
        if (current === null) {
          showToast(t('page.noTrack'))
          return
        }
        if (current.onlineProvider) {
          setSource(current.onlineProvider)
          setUi({ nav: 'recent', filter: null, query: '' })
        } else {
          setSource('local')
          setUi({ nav: 'songs', filter: null, query: '' })
        }
        setLocatePath(current.path)
        setTimeout(function () {
          setLocatePath('')
        }, 1200)
      }

      var contentProps = {
        ui: ui,
        library: library,
        online: online,
        prefs: prefs,
        currentPath: current ? current.path : '',
        playing: snap.playing,
        favoriteSet: favorites,
        locatePath: locatePath,
        onMenu: openTrackMenu,
        onToggleFavorite: function (track) {
          void toggleFavorite(track.path)
        },
      }

      function closeGuide(disable) {
        dismissStartupGuide(disable === true)
        setGuideOpen(false)
      }

      return h(
        'div',
        { className: cx('mp-root', prefs.layout === 'top' && 'is-top') },
        h(TopBar, { ui: ui, online: online, prefs: prefs }),
        h(
          'div',
          { className: 'mp-workspace' },
          h(NavRail, { source: ui.source, nav: ui.nav, favoritesCount: favoriteCount }),
          h(
            'div',
            { className: 'mp-content' },
            h(SectionBar, { source: ui.source, nav: ui.nav, favoritesCount: favoriteCount }),
            h(ContentArea, contentProps),
          ),
        ),
        h(PlayerBar, {
          favoriteSet: favorites,
          queueOpen: ui.queueOpen && ui.queueSource === 'bar' && ui.npOpen !== true,
          onToggleQueue: function () {
            setUi({ queueOpen: !ui.queueOpen, queueSource: 'bar' })
          },
          onOpenNowPlaying: function () {
            setUi({ npOpen: true, queueOpen: false })
          },
          onLocate: locateCurrent,
          onToggleFavorite: function (track) {
            void toggleFavorite(track.path)
          },
        }),
        h(NowPlaying, {
          open: ui.npOpen === true,
          favoriteSet: favorites,
          onClose: function () {
            setUi({ npOpen: false, queueOpen: false })
          },
          queueOpen: ui.queueOpen && ui.queueSource === 'np',
          onToggleQueue: function () {
            setUi({ queueOpen: !ui.queueOpen, queueSource: 'np' })
          },
          onToggleFavorite: function (track) {
            void toggleFavorite(track.path)
          },
        }),
        h(OverlayRoot),
        h(Toast),
        h(StartupGuide, { open: guideOpen, onClose: closeGuide }),
      )
    }

    // ── src/ui/12-composer.js
    /**
     * composer seats: the inline lyric line and the compact transport next to the
     * chat input. Both are optional and disappear when nothing is playing.
     */

    var useComposerLayoutEffect =
      typeof React !== 'undefined' && typeof React.useLayoutEffect === 'function' ? React.useLayoutEffect : useEffect

    function firstComposerTranslation(value) {
      var parts = String(value || '').split(/\r?\n/)
      for (var i = 0; i < parts.length; i += 1) {
        var text = parts[i].trim()
        if (text !== '') return text
      }
      return ''
    }

    function composerLyricContent(entry) {
      var translation = firstComposerTranslation(entry.translation)
      return [
        h('span', { key: 'main', className: 'mp-composer-lyric-main' }, entry.text),
        translation
          ? h('span', { key: 'trans', className: 'mp-composer-lyric-trans' }, translation)
          : null,
      ]
    }

    function ComposerLyricText(props) {
      var line = props.line
      var showTranslation = props.showTranslation === true
      var text = line ? line.text : props.fallback
      var translation = showTranslation && line ? firstComposerTranslation(line.translation) : ''
      var key = (props.index >= 0 ? props.index : 'fallback') + '|' + text + '|' + translation
      var pair = useState(function () {
        return { current: { key: key, text: text, translation: translation }, previous: null }
      })
      var view = pair[0]
      var setView = pair[1]
      useEffect(
        function () {
          setView(function (previous) {
            if (previous.current && previous.current.key === key) return previous
            return {
              current: { key: key, text: text, translation: translation },
              previous: previous.current,
            }
          })
        },
        [key, text, translation],
      )
      var current = view.current
      var leaving = view.previous
      return h(
        'span',
        { className: 'mp-composer-lyric-viewport' },
        leaving
          ? h(
              'span',
              { key: 'out-' + leaving.key, className: 'mp-composer-lyric-layer is-leaving', 'aria-hidden': 'true' },
              composerLyricContent(leaving),
            )
          : null,
        h(
          'span',
          { key: 'in-' + current.key, className: 'mp-composer-lyric-layer is-entering' },
          composerLyricContent(current),
        ),
      )
    }

    function ComposerLyrics() {
      var prefs = usePrefs()
      var snap = usePlayerSnapshot()
      var time = usePlayerTime()
      var track = snap.queue[snap.index] || null
      var trackPath = track ? track.path : ''
      var pair = useState([])
      var lines = pair[0]
      var setLines = pair[1]

      useEffect(
        function () {
          if (prefs.composerLyrics !== true || trackPath === '') {
            setLines([])
            return undefined
          }
          var cancelled = false
          var active = snap.queue[snap.index]
          if (!active) return undefined
          async function load() {
            try {
              if (active.onlineProvider) {
                var body = await getJson(
                  API +
                    'online/lyric?provider=' +
                    encodeURIComponent(active.onlineProvider) +
                    '&id=' +
                    encodeURIComponent(active.onlineId || ''),
                )
                var lines = parseLrcText(body.lrc || '')
                if (body.translation) mergeLyricTranslation(lines, body.translation)
                if (!cancelled) setLines(lines)
                return
              }
              var local = await getJson(
                API + 'lyrics?path=' + encodeURIComponent(active.path) + '&order=embedded,lrc',
              )
              if (!cancelled) setLines(Array.isArray(local.lines) ? local.lines : [])
            } catch (error) {
              if (!cancelled) setLines([])
            }
          }
          load()
          return function () {
            cancelled = true
          }
        },
        [prefs.composerLyrics, trackPath],
      )

      if (prefs.composerLyrics !== true || track === null) return null
      var index = lyricActiveIndex(lines, time.currentTime)
      var line = index >= 0 ? lines[index] : null
      return h(
        'div',
        { className: 'mp-composer-lyrics' },
        h('span', { className: 'mp-composer-lyric-icon' }, icon('note', 12)),
        h(ComposerLyricText, {
          line: line,
          index: index,
          fallback: trackTitleOf(track),
          showTranslation:
            prefs.composerTranslation !== false && prefs.showTranslation === true,
        }),
      )
    }

    function ComposerCluster() {
      var snap = usePlayerSnapshot()
      var ui = useStore(uiStore)
      var track = snap.queue[snap.index] || null
      var queueOpen = ui.queueOpen === true && ui.queueSource === 'composer'
      if (track === null) return null
      return h(
        'div',
        { className: 'mp-composer-cluster' },
        h(
          'button',
          {
            type: 'button',
            className: 'mp-cbtn',
            title: snap.playing ? t('page.pause') : t('page.play'),
            onClick: function () {
              player.toggle()
            },
          },
          icon(snap.playing ? 'pause' : 'play', 14),
        ),
        h(
          'button',
          {
            type: 'button',
            className: cx('mp-cbtn', queueOpen && 'is-on'),
            'data-queue-toggle': 'true',
            title: t('page.queue'),
            onClick: function () {
              setUi({ queueOpen: !queueOpen, queueSource: 'composer' })
            },
          },
          icon('playlist', 14),
          h('span', null, trackTitleOf(track)),
        ),
      )
    }

    function GlobalQueueHost() {
      var state = useStore(uiStore)
      var open = state.queueOpen === true && state.queueSource === 'composer'
      var snap = usePlayerSnapshot()
      var posPair = useState(null)
      var pos = posPair[0]
      var setPos = posPair[1]
      useEffect(
        function () {
          function onKey(event) {
            if (event.key === 'Escape' && uiStore.get().queueOpen) {
              setUi({ queueOpen: false })
            }
          }
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('keydown', onKey)
          }
        },
        [],
      )
      useComposerLayoutEffect(
        function () {
          if (open !== true) {
            setPos(null)
            return undefined
          }
          function place() {
            var button = document.querySelector('.mp-composer-cluster [data-queue-toggle]')
            if (!button) {
              setPos({ left: 'auto', right: '24px', bottom: '96px', width: 'min(340px, calc(100vw - 16px))' })
              return
            }
            var rect = button.getBoundingClientRect()
            var width = Math.min(340, window.innerWidth - 16)
            var left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))
            var below = rect.top < window.innerHeight * 0.5
            setPos(
              below
                ? { left: left + 'px', right: 'auto', top: rect.bottom + 10 + 'px', bottom: 'auto', width: width + 'px' }
                : { left: left + 'px', right: 'auto', top: 'auto', bottom: window.innerHeight - rect.top + 10 + 'px', width: width + 'px' },
            )
          }
          place()
          window.addEventListener('resize', place)
          window.addEventListener('scroll', place, true)
          return function () {
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', place, true)
          }
        },
        [open],
      )
      return h(QueuePopover, {
        open: open,
        snap: snap,
        style: pos || { visibility: 'hidden' },
        onClose: function () {
          setUi({ queueOpen: false })
        },
      })
    }

    // ── src/ui/13-batch.js
    /**
     * batch edit and duplicate cleanup dialogs.
     */

    function BatchEditDialog(props) {
      var paths = props.layer.props.paths || []
      var pair = useState({ artist: '', album: '', genre: '', albumArtist: '' })
      var form = pair[0]
      var setForm = pair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]

      function field(key, label) {
        return h(
          'div',
          { className: 'mp-field' },
          h('label', null, label),
          h('input', {
            type: 'text',
            value: form[key] || '',
            placeholder: t('page.keepEmpty'),
            onChange: function (event) {
              var value = event.target.value
              setForm(function (previous) {
                var next = Object.assign({}, previous)
                next[key] = value
                return next
              })
            },
          }),
        )
      }

      function save() {
        if (busy) return
        var patch = {}
        ;['artist', 'album', 'genre', 'albumArtist'].forEach(function (key) {
          var value = String(form[key] || '').trim()
          if (value !== '') patch[key] = value
        })
        if (Object.keys(patch).length === 0) {
          showToast(t('page.batchEmpty'))
          return
        }
        setBusy(true)
        batchEditTags(paths, patch).then(function (result) {
          setBusy(false)
          popLayer()
          showToast(t('page.batchSaved', { n: result.done }))
          void loadLibrary(true)
        })
      }

      return h(
        KitModal,
        {
          title: t('page.batchEdit'),
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'save',
                variant: 'primary',
                disabled: busy,
                onClick: save,
              },
              busy ? t('page.saving') : t('page.save'),
            ),
          ],
        },
    h(
            'div',
            { className: 'mp-kit-body' },
            h('div', { className: 'mp-set-desc' }, t('page.batchHint', { n: paths.length })),
            h(
              'div',
              { className: 'mp-d-grid' },
              field('artist', t('page.artist')),
              field('album', t('page.album')),
              field('genre', t('page.genre')),
              field('albumArtist', t('page.albumArtist')),
            ),
          ),

      )
    }

    function DuplicatesDialog(props) {
      var groups = props.layer.props.groups || []
      var removals = []
      var rows = groups.map(function (group) {
        var sorted = group.slice().sort(compareQuality)
        sorted.slice(1).forEach(function (track) {
          removals.push(track.path)
        })
        return { keep: sorted[0], drop: sorted.slice(1) }
      })

      function clean() {
        if (removals.length === 0) return
        pushLayer('confirm', {
          title: t('page.duplicatesTitle'),
          text: t('page.deleteDuplicatesConfirm', { n: removals.length }),
          onConfirm: function () {
            removeTracks(removals)
              .then(function (body) {
                showToast(t('page.duplicatesRemoved', { n: (body.moved || []).length }))
                removeLayer('duplicates')
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
      }

      return h(
        KitModal,
        {
          title: t('page.duplicatesTitle') + ' · ' + groups.length,
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { removeLayer('duplicates') } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'clean',
                variant: 'primary',
                disabled: removals.length === 0,
                onClick: clean,
              },
              t('page.deleteDuplicates'),
            ),
          ],
        },
    h(
            'div',
            { className: 'mp-kit-body' },
            h('div', { className: 'mp-set-desc' }, t('page.duplicatesHint')),
            rows.map(function (row, index) {
              return h(
                'div',
                { key: String(index), className: 'mp-dupe-group' },
                h(
                  'div',
                  { className: 'mp-dupe-row is-keep' },
                  icon('check', 13),
                  h('span', { className: 'mp-ellipsis' }, trackTitleOf(row.keep) + ' · ' + trackArtistOf(row.keep)),
                  h('span', { className: 'mp-dupe-meta' }, fmtKbps(row.keep.bitrate) || fmtKhz(row.keep.sampleRate) || ''),
                ),
                row.drop.map(function (track) {
                  return h(
                    'div',
                    { key: track.path, className: 'mp-dupe-row is-drop' },
                    icon('trash', 12),
                    h('span', { className: 'mp-ellipsis' }, track.path),
                    h('span', { className: 'mp-dupe-meta' }, fmtKbps(track.bitrate) || fmtKhz(track.sampleRate) || ''),
                  )
                }),
              )
            }),
          ),

      )
    }

    // ── src/ui/14-online-lyric.js
    /**
     * online lyric search: pick a candidate, preview the LRC, hand it back.
     *
     * Used from the tag editor (fills the lyrics box) and from the player (writes
     * the lyrics straight into the file).
     */

    function OnlineLyricDialog(props) {
      var track = props.layer.props.track || {}
      var onApply = props.layer.props.onApply
      var queryPair = useState((track.title || '').trim())
      var query = queryPair[0]
      var setQuery = queryPair[1]
      var phasePair = useState('idle')
      var phase = phasePair[0]
      var setPhase = phasePair[1]
      var listPair = useState([])
      var candidates = listPair[0]
      var setCandidates = listPair[1]
      var previewPair = useState(null)
      var preview = previewPair[0]
      var setPreview = previewPair[1]
      var errorPair = useState('')
      var error = errorPair[0]
      var setError = errorPair[1]

      function search() {
        var text = String(query || '').trim()
        if (text === '' || phase === 'loading') return
        setPhase('loading')
        setError('')
        setCandidates([])
        setPreview(null)
        getJson(API + 'lyrics/search?q=' + encodeURIComponent(text))
          .then(function (body) {
            setCandidates(Array.isArray(body.candidates) ? body.candidates : [])
            setPhase('ready')
          })
          .catch(function (searchError) {
            setError(errorText(searchError))
            setPhase('error')
          })
      }

      function choose(candidate) {
        if (!candidate || !candidate.id) return
        setError('')
        setPhase('loading')
        getJson(API + 'lyrics/fetch?id=' + encodeURIComponent(candidate.id))
          .then(function (body) {
            var lines = parseLrcText(body.lrc || '')
            if (body.translation) mergeLyricTranslation(lines, body.translation)
            setPreview({ lrc: body.lrc || '', lines: lines, title: candidate.title, artist: candidate.artist })
            setPhase('ready')
          })
          .catch(function (fetchError) {
            setError(errorText(fetchError))
            setPhase('error')
          })
      }

      function apply() {
        if (!preview || preview.lrc.trim() === '') return
        popLayer()
        if (typeof onApply === 'function') {
          var hasTranslation = preview.lines.some(function (line) {
            return line.translation !== ''
          })
          onApply(hasTranslation ? buildTranslatedLrc(preview.lines, preview.lrc) : preview.lrc)
        }
      }

      var previewLines =
        preview === null
          ? []
          : preview.lines.filter(function (line) {
              return String(line.text || '').trim() !== '' || String(line.translation || '').trim() !== ''
            })

      return h(
        KitModal,
        {
          title: t('page.onlineLyrics'),
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(Button, { key: 'apply', variant: 'primary', disabled: preview === null, onClick: apply }, t('page.lyricsApply')),
          ],
        },
    h(
            'div',
            { className: 'mp-kit-body' },
            h(
              'div',
              { style: { display: 'flex', gap: '8px' } },
              h('input', {
                type: 'search',
                value: query,
                placeholder: t('page.lyricsSearchPlaceholder'),
                style: {
                  flex: '1',
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
                  background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
                  color: 'inherit',
                  font: 'inherit',
                  outline: 'none',
                },
                onChange: function (event) {
                  setQuery(event.target.value)
                },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') search()
                },
              }),
              h(Button, { variant: 'primary', disabled: phase === 'loading', onClick: search }, t('page.lyricsSearch')),
            ),
            error !== '' ? h('div', { className: 'mp-set-desc', style: { color: 'var(--dsw-alias-state-error-primary,#f87171)' } }, error) : null,
            phase === 'loading' ? h('div', { className: 'mp-empty', style: { padding: '20px' } }, h(Spinner)) : null,
            preview === null
              ? phase === 'ready' && candidates.length === 0
                ? h('div', { className: 'mp-empty', style: { padding: '24px' } }, h('span', null, t('page.lyricsNoResults')))
                : h(
                    'div',
                    { className: 'mp-lyr-candidates' },
                    candidates.map(function (candidate) {
                      return h(
                        'button',
                        {
                          key: String(candidate.id),
                          type: 'button',
                          className: 'mp-lyr-candidate',
                          onClick: function () {
                            choose(candidate)
                          },
                        },
                        h(
                          'div',
                          { className: 'mp-lyr-candidate-main' },
                          h('div', { className: 'mp-srow-title' }, candidate.title || ''),
                          h('div', { className: 'mp-srow-sub' }, candidate.artist || ''),
                        ),
                        h('div', { className: 'mp-srow-meta' }, fmtTime(candidate.durationSec)),
                      )
                    }),
                  )
              : h(
                  'div',
                  { className: 'mp-lyr-preview-wrap' },
                  h(
                    'div',
                    { className: 'mp-lyr-preview-head' },
                    h(
                      'div',
                      { className: 'mp-lyr-preview-meta' },
                      h('div', { className: 'mp-lyr-preview-title' }, preview.title || ''),
                      h('div', { className: 'mp-lyr-preview-artist' }, preview.artist || ''),
                    ),
                    h('span', { className: 'mp-lyr-preview-count' }, t('page.lyricsLineCount', { n: previewLines.length })),
                    h(
                      Button,
                      {
                        variant: 'ghost',
                        onClick: function () {
                          setPreview(null)
                        },
                      },
                      t('page.lyricsBack'),
                    ),
                  ),
                  previewLines.length === 0
                    ? h('div', { className: 'mp-set-desc' }, t('page.lyricsNoResults'))
                    : h(
                        'div',
                        { className: 'mp-lyr-preview' },
                        previewLines.map(function (line, index) {
                          var meta = isLyricMetadata(line.text)
                          var stamp = formatLrcTime(line.time).slice(1, -1)
                          return h(
                            'div',
                            { key: String(index), className: cx('mp-lyr-line', meta && 'is-meta') },
                            h('span', { className: 'mp-lyr-time' }, stamp),
                            h(
                              'div',
                              { className: 'mp-lyr-copy' },
                              line.text ? h('div', { className: 'mp-lyr-orig' }, line.text) : null,
                              line.translation ? h('div', { className: 'mp-lyr-tr' }, line.translation) : null,
                            ),
                          )
                        }),
                      ),
                ),
          ),

      )
    }

    // ── src/ui/15-trash.js
    /**
     * trash: restore tracks that were moved out of the library.
     */

    function TrashDialog(props) {
      var statePair = useState({ phase: 'loading', entries: [] })
      var state = statePair[0]
      var setState = statePair[1]
      var busyPair = useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]

      useEffect(function () {
        var cancelled = false
        getJson(API + 'trash')
          .then(function (body) {
            if (cancelled) return
            setState({ phase: 'ready', entries: Array.isArray(body.entries) ? body.entries : [] })
          })
          .catch(function (error) {
            if (cancelled) return
            setState({ phase: 'error', entries: [], error: errorText(error) })
          })
        return function () {
          cancelled = true
        }
      }, [])

      function restore(entry) {
        if (busy !== '') return
        setBusy(entry.id)
        postJson(API + 'trash/restore', { id: entry.id })
          .then(function () {
            setBusy('')
            setState(function (previous) {
              return {
                phase: previous.phase,
                entries: previous.entries.filter(function (item) {
                  return item.id !== entry.id
                }),
              }
            })
            showToast(t('v2.restored', { name: entry.name }))
            void loadLibrary(true)
          })
          .catch(function (error) {
            setBusy('')
            showToast(errorText(error))
          })
      }

      var count = state.phase === 'ready' ? state.entries.length : 0
      var body = h('div', { className: 'mp-set-desc' }, t('v2.trashHint'))
      if (state.phase === 'loading') {
        body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, h(Spinner))
      } else if (state.phase === 'error') {
        body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, state.error || '')
      } else if (state.entries.length === 0) {
        body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, t('v2.trashEmpty'))
      } else {
        body = h(
          'div',
          { className: 'mp-trash-list' },
          state.entries.map(function (entry) {
            return h(
              'div',
              { key: entry.id, className: 'mp-trash-row' },
              h('span', { className: 'mp-trash-icon' }, icon('trash', 14)),
              h(
                'div',
                { className: 'mp-trash-main' },
                h('div', { className: 'mp-ellipsis' }, entry.name),
                h(
                  'div',
                  { className: 'mp-trash-path' },
                  (entry.originalPath || t('v2.trashNoPath')) +
                    ' · ' +
                    fmtBytes(entry.size) +
                    ' · ' +
                    new Date(entry.mtime).toLocaleString(),
                ),
              ),
              h(
                Button,
                {
                  variant: 'primary',
                  disabled: busy !== '',
                  onClick: function () {
                    restore(entry)
                  },
                },
                busy === entry.id ? t('page.saving') : t('v2.restore'),
              ),
            )
          }),
        )
      }

      return h(
        KitModal,
        {
          title: t('v2.trash') + (state.phase === 'ready' ? ' · ' + count : ''),
          onClose: popLayer,
          footer: h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('v2.close')),
        },
        h('div', { className: 'mp-set-desc' }, t('v2.trashHint')),
        body,
      )
    }

    // ── src/ui/16-header.js
    /**
     * shared content header: title + count, select / sort / search actions, and the
     * play-mode pills row used by both the local and online libraries.
     */

    function focusGlobalSearch() {
      try {
        var input = document.querySelector('.mp-search-input')
        if (input) {
          input.focus()
          if (typeof input.select === 'function') input.select()
        }
      } catch (error) {
        // Search focus is best-effort only.
      }
    }

    function HeadMenu(props) {
      var openPair = useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      var ref = useRef(null)

      useEffect(
        function () {
          if (!open) return undefined
          if (props.hostMenu !== false && hostComponent('Menu') !== null) return undefined
          function onDown(event) {
            if (ref.current && ref.current.contains(event.target)) return
            setOpen(false)
          }
          function onKey(event) {
            if (event.key === 'Escape') setOpen(false)
          }
          document.addEventListener('pointerdown', onDown, true)
          window.addEventListener('keydown', onKey)
          return function () {
            document.removeEventListener('pointerdown', onDown, true)
            window.removeEventListener('keydown', onKey)
          }
        },
        [open],
      )

      var trigger = h(IconButton, {
        icon: props.icon,
        size: 17,
        title: props.title,
        active: open,
        onClick: function () {
          setOpen(!open)
        },
      })
      var HostMenu = props.hostMenu === false ? null : hostComponent('Menu')
      if (HostMenu !== null) {
        var hostItems = props.items.map(function (item) {
          if (item.separator) return { type: 'separator', id: item.key }
          return {
            id: item.key,
            label: item.label,
            icon: item.icon ? icon(item.icon, 13) : undefined,
            disabled: item.disabled === true,
            danger: item.danger === true,
          }
        })
        var selectedId
        props.items.forEach(function (item) {
          if (item.active === true && selectedId === undefined) selectedId = item.key
        })
        return h(HostMenu, {
          open: open,
          anchor: trigger,
          items: hostItems,
          selectedId: selectedId,
          onSelect: function (id) {
            setOpen(false)
            var chosen = null
            props.items.forEach(function (item) {
              if (chosen === null && item.key === id) chosen = item
            })
            if (chosen !== null && typeof chosen.run === 'function') chosen.run()
          },
          onClose: function () {
            setOpen(false)
          },
          side: 'bottom',
          align: 'end',
          portal: true,
          compact: true,
          className: 'mp-headmenu-host',
        })
      }

      return h(
        'div',
        { className: 'mp-headmenu', ref: ref },
        trigger,
        open
          ? h(
              'div',
              { className: 'mp-headmenu-pop', role: 'menu' },
              props.items.map(function (item) {
                if (item.separator) return h('hr', { key: item.key, className: 'mp-headmenu-sep' })
                return h(
                  'button',
                  {
                    key: item.key,
                    type: 'button',
                    role: 'menuitem',
                    className: cx('mp-headmenu-item', item.active === true && 'is-on'),
                    onClick: function () {
                      setOpen(false)
                      if (typeof item.run === 'function') item.run()
                    },
                  },
                  item.icon ? icon(item.icon, 13) : null,
                  h('span', { className: 'mp-headmenu-label' }, item.label),
                  item.hint ? h('span', { className: 'mp-headmenu-hint' }, item.hint) : null,
                )
              }),
            )
          : null,
      )
    }

    function SelectMenu(props) {
      return h(HeadMenu, {
        icon: 'checkCircle',
        title: t('page.select'),
        items: [
          { key: 'all', icon: 'check', label: t('v2.selAll'), run: props.onAll },
          { key: 'none', icon: 'x', label: t('v2.selNone'), run: props.onNone },
          { key: 'range', icon: 'target', label: t('v2.selRange'), run: props.onRange },
          { key: 'invert', icon: 'refresh', label: t('v2.selInvert'), run: props.onInvert },
        ],
      })
    }

    function SortMenu() {
      var prefs = usePrefs()
      var fields = [
        ['title', t('v2.sortTitle')],
        ['artist', t('v2.sortArtist')],
        ['duration', t('v2.sortDuration')],
        ['added', t('v2.sortAdded')],
        ['recent', t('v2.sortRecent')],
      ]
      var items = fields.map(function (entry) {
        return {
          key: entry[0],
          label: entry[1],
          active: prefs.sortBy === entry[0],
          run: function () {
            setPrefs({ sortBy: entry[0] })
          },
        }
      })
      items.push({ key: 'sep', separator: true })
      items.push({
        key: 'asc',
        label: t('page.sortAsc'),
        hint: '↑',
        active: prefs.sortDir === 'asc',
        run: function () {
          setPrefs({ sortDir: 'asc' })
        },
      })
      items.push({
        key: 'desc',
        label: t('page.sortDesc'),
        hint: '↓',
        active: prefs.sortDir === 'desc',
        run: function () {
          setPrefs({ sortDir: 'desc' })
        },
      })
      return h(HeadMenu, { icon: 'sort', title: t('page.sort'), items: items, hostMenu: false })
    }

    function ContentHeader(props) {
      return h(
        'header',
        { className: 'mp-content-head' },
        h('h1', { className: 'mp-title', title: props.title }, props.title),
        h('span', { className: 'mp-count' }, props.count > 0 ? t('page.trackCountUnit', { n: props.count }) : ''),
        props.selecting === true && (props.selectedCount || 0) > 0
          ? h('span', { className: 'mp-sel-count' }, t('page.selectedCount', { n: props.selectedCount }))
          : null,
        h(
          'div',
          { className: 'mp-head-actions' },
          h(SelectMenu, {
            onAll: props.onAll,
            onNone: props.onNone,
            onRange: props.onRange,
            onInvert: props.onInvert,
          }),
          h(SortMenu),
          h(IconButton, { icon: 'search', size: 17, title: t('v2.searchFocus'), onClick: focusGlobalSearch }),
        ),
      )
    }

    // ── src/ui/17-folder-picker.js
    /**
     * folder picker: read-only directory browser backed by GET /browse.
     *
     * Used from Settings → 音乐库 and from the folder view quick-add button.
     */

    function FolderPickerDialog(props) {
      var statePair = useState({ phase: 'loading', path: '', parent: null, dirs: [], error: '' })
      var state = statePair[0]
      var setState = statePair[1]

      function load(target) {
        setState(function (previous) {
          return Object.assign({}, previous, { phase: 'loading', error: '' })
        })
        getJson(API + 'browse?path=' + encodeURIComponent(target))
          .then(function (body) {
            setState({
              phase: 'ready',
              path: body.path || '',
              parent: body.parent === undefined ? null : body.parent,
              dirs: Array.isArray(body.dirs) ? body.dirs : [],
              error: '',
            })
          })
          .catch(function (error) {
            setState(function (previous) {
              return Object.assign({}, previous, { phase: 'error', error: errorText(error) })
            })
          })
      }

      useEffect(function () {
        load('')
      }, [])

      function useHere() {
        if (state.path === '') return
        var config = libraryStore.get().config || {}
        var roots = Array.isArray(config.roots) ? config.roots.slice() : []
        if (roots.indexOf(state.path) < 0) roots.push(state.path)
        var after = function (ok) {
          if (!ok) return
          showToast(t('v2.folderAdded'))
          popLayer()
        }
        saveConfig({ roots: roots }).then(after)
      }

      var list = null
      if (state.phase === 'loading') {
        list = h('div', { className: 'mp-folder-state' }, h(Spinner), h('span', null, t('v2.loading')))
      } else if (state.phase === 'error') {
        list = h('div', { className: 'mp-folder-state' }, state.error || t('page.loadFailed'))
      } else if (state.dirs.length === 0) {
        list = h('div', { className: 'mp-folder-state' }, t('v2.folderEmpty'))
      } else {
        list = h(
          'div',
          { className: 'mp-folder-list' },
          state.parent !== null && state.parent !== undefined
            ? h(
                'button',
                { type: 'button', className: 'mp-folder-row', onClick: function () { load(state.parent) } },
                icon('chevronLeft', 14),
                h('span', null, t('v2.folderUp')),
              )
            : null,
          state.dirs.map(function (dir) {
            return h(
              'button',
              {
                key: dir.path,
                type: 'button',
                className: 'mp-folder-row',
                onClick: function () {
                  load(dir.path)
                },
              },
              icon('folder', 16),
              h('span', { className: 'mp-folder-row-name', title: dir.name }, dir.name),
            )
          }),
        )
      }

      return h(
        KitModal,
        {
          title: t('v2.folderPick'),
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'here',
                variant: 'primary',
                icon: 'check',
                disabled: state.path === '' || state.phase !== 'ready',
                onClick: useHere,
              },
              t('v2.folderHere'),
            ),
          ],
        },
        h(
          'div',
          { className: 'mp-folder-path', title: state.path },
          state.path === '' ? t('v2.folderPick') : state.path,
        ),
        list,
      )
    }

    // ── src/ui/18-online-add.js
    /**
     * add one online song to one of the signed-in account's cloud playlists.
     */

    function OnlineAddToDialog(props) {
      var layerProps = props.layer.props || {}
      var track = layerProps.track || null
      var provider = track && track.onlineProvider ? track.onlineProvider : ''
      var statePair = useState({ phase: 'loading', playlists: [], error: '' })
      var state = statePair[0]
      var setState = statePair[1]
      var busyPair = useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]

      useEffect(
        function () {
          if (provider === '') return undefined
          var cancelled = false
          getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(provider))
            .then(function (body) {
              if (cancelled) return
              setState({
                phase: 'ready',
                playlists: Array.isArray(body.playlists) ? body.playlists : [],
                error: '',
              })
            })
            .catch(function (error) {
              if (cancelled) return
              setState({ phase: 'error', playlists: [], error: errorText(error) })
            })
          return function () {
            cancelled = true
          }
        },
        [provider],
      )

      function addTo(playlist) {
        if (busy !== '' || track === null) return
        setBusy(playlist.id)
        postJson(API + 'online/playlist-add', {
          provider: provider,
          playlistId: playlist.id,
          song: track,
        })
          .then(function () {
            setBusy('')
            showToast(t('online.addedToCloudPlaylist'))
            popLayer()
          })
          .catch(function (error) {
            setBusy('')
            showToast(errorText(error))
          })
      }

      var body = null
      if (state.phase === 'loading') {
        body = h('div', { className: 'mp-folder-state' }, h(Spinner), h('span', null, t('v2.loading')))
      } else if (state.phase === 'error') {
        body = h('div', { className: 'mp-folder-state' }, state.error || t('page.loadFailed'))
      } else if (state.playlists.length === 0) {
        body = h('div', { className: 'mp-folder-state' }, t('online.noCloudPlaylists'))
      } else {
        body = h(
          'div',
          { className: 'mp-folder-list' },
          state.playlists.map(function (playlist) {
            return h(
              'button',
              {
                key: playlist.id,
                type: 'button',
                className: 'mp-srow',
                disabled: busy !== '',
                onClick: function () {
                  addTo(playlist)
                },
              },
              h(
                'div',
                { className: 'mp-srow-cover' },
                playlist.cover
                  ? h(Cover, { src: onlineCoverSrc({ coverUrl: playlist.cover }), iconSize: 18 })
                  : icon('list', 18),
              ),
              h(
                'div',
                { className: 'mp-srow-main' },
                h('div', { className: 'mp-srow-title' }, playlist.name || ''),
                h('div', { className: 'mp-srow-sub' }, (playlist.trackCount || 0) + ' · ' + t('v2.songs')),
              ),
              busy === playlist.id ? h(Spinner) : icon('plus', 14),
            )
          }),
        )
      }

      return h(
        KitModal,
        {
          title: t('online.addToCloudPlaylist'),
          onClose: popLayer,
          footer: h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('v2.close')),
        },
        h('div', { className: 'mp-set-desc' }, track ? track.title || '' : ''),
        body,
      )
    }

    // ── src/ui/19-navidrome-dialog.js
    /**
     * Navidrome / Subsonic connection dialog.
     *
     * Navidrome has no QR sign-in, so the top-bar chip opens this form instead of
     * the shared login layer: server URL, username, password, and a save button.
     *
     * The password is sent once to POST /online/navidrome/login, where the host
     * trades it for a salted token (md5(paste + salt)) and persists only that. It
     * is cleared from component state the moment the request settles.
     */

    function NavidromeDialog() {
      var serverPair = useState('')
      var userPair = useState('')
      var passPair = useState('')
      var busyPair = useState(false)
      var errorPair = useState('')
      var noticePair = useState('')
      // Opt-in: keeping the password is the only way to page the whole library,
      // because the native API mints a JWT from it.
      var keepPair = useState(false)
      var keepPassword = keepPair[0]
      var setKeepPassword = keepPair[1]

      var server = serverPair[0]
      var setServer = serverPair[1]
      var username = userPair[0]
      var setUsername = userPair[1]
      var password = passPair[0]
      var setPassword = passPair[1]
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var error = errorPair[0]
      var setError = errorPair[1]
      var notice = noticePair[0]
      var setNotice = noticePair[1]

      function save() {
        if (busy) return
        var trimmedServer = String(server || '').trim()
        var trimmedUser = String(username || '').trim()
        var secret = String(password || '')
        setError('')
        setNotice('')

        if (!/^https?:\/\//i.test(trimmedServer)) {
          setError(t('online.navidromeBadServer'))
          return
        }
        if (trimmedUser === '') {
          setError(t('online.navidromeNeedUser'))
          return
        }
        if (secret === '') {
          setError(t('online.navidromeNeedPassword'))
          return
        }

        setBusy(true)
        postJson(API + 'online/navidrome/login', {
          server: trimmedServer,
          username: trimmedUser,
          password: secret,
          storePassword: keepPassword === true,
        })
          .then(function (result) {
            setBusy(false)
            // Drop the secret as soon as it is spent.
            setPassword('')
            setNotice(t('online.navidromeOk', { version: (result && result.serverVersion) || 'ok' }))
            void loadProviders()
            showToast(t('online.loginSuccess'))
            // Leave the dialog open briefly so the success line is readable, then
            // close and land on the source the user just configured.
            window.setTimeout(function () {
              popLayer()
            }, 700)
          })
          .catch(function (err) {
            setBusy(false)
            setError(errorText(err))
          })
      }

      function onKeyDown(event) {
        if (event.key === 'Enter') save()
        if (event.key === 'Escape') popLayer()
      }

      return h(
        KitModal,
        {
          title: t('online.navidromeTitle'),
          small: true,
          onClose: popLayer,
          footer: h(
            'div',
            { className: 'mp-navidrome-footer' },
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              { key: 'save', variant: 'primary', disabled: busy, onClick: save },
              busy ? t('online.navidromeConnecting') : t('online.navidromeSave'),
            ),
          ),
        },
        h(
          'div',
          { className: 'mp-navidrome-form' },
          h('label', { className: 'mp-navidrome-label' }, t('online.navidromeServer')),
          h('input', {
            className: 'mp-kit-input',
            type: 'url',
            placeholder: t('online.navidromeServerPlaceholder'),
            value: server,
            disabled: busy,
            autoFocus: true,
            onKeyDown: onKeyDown,
            onChange: function (event) {
              setServer(event.target.value)
            },
          }),
          h('label', { className: 'mp-navidrome-label' }, t('online.navidromeUser')),
          h('input', {
            className: 'mp-kit-input',
            type: 'text',
            value: username,
            disabled: busy,
            onKeyDown: onKeyDown,
            onChange: function (event) {
              setUsername(event.target.value)
            },
          }),
          h('label', { className: 'mp-navidrome-label' }, t('online.navidromePassword')),
          h('input', {
            className: 'mp-kit-input',
            type: 'password',
            value: password,
            disabled: busy,
            onKeyDown: onKeyDown,
            onChange: function (event) {
              setPassword(event.target.value)
            },
          }),
          h(
            'label',
            { className: 'mp-navidrome-check' },
            h('input', {
              type: 'checkbox',
              checked: keepPassword === true,
              disabled: busy,
              onChange: function (event) {
                setKeepPassword(event.target.checked === true)
              },
            }),
            h('span', null, t('online.navidromeKeep')),
          ),
          h('p', { className: 'mp-navidrome-hint' }, t('online.navidromeHint')),
          keepPassword === true ? h('p', { className: 'mp-navidrome-warn' }, t('online.navidromeKeepWarn')) : null,
          error !== '' ? h('p', { className: 'mp-online-error' }, error) : null,
          notice !== '' ? h('p', { className: 'mp-online-ok' }, notice) : null,
        ),
      )
    }

    // ── src/99-plugin.js
    /**
     * plugin: seat registration and lifecycle.
     */

    var SIDE_BANDS = [0, 2, 4, 8, 14, 24, 40, 64, 96]

    function MusicSideIcon() {
      var snap = usePlayerSnapshot()
      var ref = useRef(null)
      var widePair = useState(false)
      var wide = widePair[0]
      var setWide = widePair[1]
      var levelPair = useState([0, 0, 0, 0, 0, 0, 0, 0])
      var levels = levelPair[0]
      var setLevels = levelPair[1]
      var waveVisiblePair = useState(false)
      var waveVisible = waveVisiblePair[0]
      var setWaveVisible = waveVisiblePair[1]
      var waveFadingPair = useState(false)
      var waveFading = waveFadingPair[0]
      var setWaveFading = waveFadingPair[1]

      useEffect(
        function () {
          var node = ref.current
          if (node === null) return undefined
          // The controls are absolutely positioned so they can sit at the right
          // edge of the host row. Some DSH sidebar rows are not positioned, which
          // made them escape to the nearest positioned ancestor (often the whole
          // sidebar). Mark the host row here instead of relying on its CSS.
          var row = node.closest('button') || node.closest('[role="button"]') || node.closest('a')
          if (row !== null) row.classList.add('mp-side-row')
          // Host rows are React-managed. When playback starts the host re-renders
          // and can overwrite className, dropping our positioning hook and making
          // the controls anchor to the sidebar instead. Put it back if that happens.
          var rowObserver =
            typeof MutationObserver === 'function' && row !== null
              ? new MutationObserver(function () {
                  if (!row.classList.contains('mp-side-row')) row.classList.add('mp-side-row')
                })
              : null
          if (rowObserver !== null) {
            rowObserver.observe(row, { attributes: true, attributeFilter: ['class'] })
          }
          function measure() {
            setWide(row !== null && row.getBoundingClientRect().width >= 230)
          }
          measure()
          var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
          if (observer !== null && row !== null) observer.observe(row)
          window.addEventListener('resize', measure)
          return function () {
            window.removeEventListener('resize', measure)
            if (observer !== null) observer.disconnect()
            if (rowObserver !== null) rowObserver.disconnect()
            if (row !== null) row.classList.remove('mp-side-row')
          }
        },
        [],
      )

      useEffect(
        function () {
          if (snap.playing !== true || snap.queue.length === 0) {
            if (levels.some(function (level) { return level > 0.01 })) {
              setWaveVisible(true)
              setWaveFading(true)
              var fadeTimer = setTimeout(function () {
                setWaveVisible(false)
                setWaveFading(false)
                setLevels([0, 0, 0, 0, 0, 0, 0, 0])
              }, 380)
              return function () {
                clearTimeout(fadeTimer)
              }
            }
            setWaveVisible(false)
            setWaveFading(false)
            setLevels([0, 0, 0, 0, 0, 0, 0, 0])
            return undefined
          }
          setWaveVisible(true)
          setWaveFading(false)
          var frame = 0
          var last = 0
          function tick(now) {
            if (now - last >= 60) {
              last = now
              var data = player.getWave()
              if (data !== null) {
                var next = []
                for (var band = 0; band < SIDE_BANDS.length - 1; band += 1) {
                  var start = SIDE_BANDS[band]
                  var end = Math.min(SIDE_BANDS[band + 1], data.length)
                  var sum = 0
                  for (var i = start; i < end; i += 1) sum += data[i]
                  var avg = end > start ? sum / (end - start) : 0
                  var normalized = Math.max(0, Math.min(1, (avg - 4) / 240))
                  next.push(0.03 + Math.pow(normalized, 1.35) * 0.93)
                }
                setLevels(next)
              }
            }
            frame = requestAnimationFrame(tick)
          }
          frame = requestAnimationFrame(tick)
          return function () {
            cancelAnimationFrame(frame)
          }
        },
        [snap.playing, snap.queue.length],
      )

      function control(key, name, title, run) {
        return h(
          'span',
          {
            key: key,
            className: 'mp-side-btn',
            role: 'button',
            tabIndex: 0,
            title: title,
            'aria-label': title,
            onClick: function (event) {
              event.preventDefault()
              event.stopPropagation()
              run()
            },
            onKeyDown: function (event) {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              event.stopPropagation()
              run()
            },
          },
          icon(name, 13),
        )
      }

      return h(
        'span',
        { className: 'mp-side-icon', ref: ref },
        icon('note', 16),
        wide && snap.queue.length > 0
          ? h(
              'span',
              { className: 'mp-side-extras' },
              waveVisible
                ? h(
                    'span',
                    { className: cx('mp-side-wave', waveFading && 'is-fading'), 'aria-hidden': 'true' },
                    levels.map(function (level, index) {
                      return h('i', {
                        key: index,
                        style: { height: Math.round(4 + level * 18) + 'px' },
                      })
                    }),
                  )
                : null,
              control('prev', 'prev', t('page.prev'), function () {
                player.prev()
              }),
              control(
                'toggle',
                snap.playing ? 'pause' : 'play',
                snap.playing ? t('page.pause') : t('page.play'),
                function () {
                  player.toggle()
                },
              ),
              control('next', 'next', t('page.next'), function () {
                player.next()
              }),
            )
          : null,
      )
    }

    function NewPlaylistDialog(props) {
      var pair = useState('')
      var name = pair[0]
      var setName = pair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]

      function create() {
        var value = name.trim()
        if (value === '' || busy) return
        setBusy(true)
        createPlaylist(value).then(function (created) {
          setBusy(false)
          if (created) {
            popLayer()
            openLocalPlaylist(created.id)
          }
        })
      }

      return h(
        'div',
        { className: 'mp-overlay is-on' },
        h('div', { className: 'mp-scrim', onClick: function () { popLayer() } }),
        h(
          'div',
          { className: 'mp-dialog is-sm', role: 'dialog', 'aria-label': t('v2.newPlaylist') },
          h(
            'div',
            { className: 'mp-d-head' },
            h('div', { className: 'mp-d-title' }, t('v2.newPlaylist')),
            h('div', { className: 'mp-spacer' }),
            h(IconButton, { icon: 'x', title: t('v2.close'), onClick: function () { popLayer() } }),
          ),
          h(
            'div',
            { className: 'mp-d-body' },
            h('input', {
              type: 'text',
              value: name,
              placeholder: t('v2.playlistName'),
              autoFocus: true,
              style: {
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
                background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
                color: 'inherit',
                font: 'inherit',
                outline: 'none',
              },
              onChange: function (event) {
                setName(event.target.value)
              },
              onKeyDown: function (event) {
                if (event.key === 'Enter') create()
              },
            }),
          ),
          h(
            'div',
            { className: 'mp-d-foot' },
            h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(Button, { variant: 'primary', disabled: busy, onClick: create }, t('page.create')),
          ),
        ),
      )
    }

    function apply(ctx) {
      try {
        if (typeof console !== 'undefined' && console.info) {
          console.info('[dsh-music-panel] host UI kit:', hostUi ? 'native' : 'fallback')
        }
      } catch (error) {
        // Logging is best-effort.
      }
      try {
        var htmlLang = document.documentElement.getAttribute('lang') || ''
        if (htmlLang !== '') LANG = String(htmlLang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
      } catch (error) {
        // Keep the initial guess.
      }

      var locale = ctx.locale
      if (
        locale !== null &&
        locale !== undefined &&
        typeof locale.register === 'function' &&
        typeof locale.bind === 'function'
      ) {
        ctx.effect(function () {
          var dispose = locale.register('dsh-music-panel', DICTS)
          return function () {
            if (typeof dispose === 'function') dispose()
          }
        })
        try {
          var bound = locale.bind('dsh-music-panel')
          if (typeof bound === 'function') localeTranslate = bound
        } catch (error) {
          localeTranslate = null
        }
      }

      ctx.effect(function () {
        var style = document.createElement('style')
        style.dataset.plugin = 'dsh-music-panel'
        style.textContent = THEME_TEXT
        document.head.appendChild(style)
        return function () {
          style.remove()
        }
      })

      ctx.effect(function () {
        return function () {
          player.suspend()
        }
      })

      ctx.effect(function () {
        function onVisibility() {
          if (document.visibilityState === 'hidden') player.flushOnHide()
        }
        function onUnload() {
          player.flushOnHide()
        }
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('beforeunload', onUnload)
        return function () {
          document.removeEventListener('visibilitychange', onVisibility)
          window.removeEventListener('beforeunload', onUnload)
        }
      })

      ctx.effect(function () {
        try {
          if (
            typeof navigator === 'undefined' ||
            navigator.locks === undefined ||
            typeof navigator.locks.request !== 'function'
          ) {
            return
          }
          if (window.__dshMusicLeaderBound === true) return
          window.__dshMusicLeaderBound = true
          var LOCK = 'dsh-music-panel.player'
          function hold() {
            return new Promise(function () {})
          }
          function becomeLeader() {
            player.setLeader(true)
            return hold()
          }
          navigator.locks
            .request(LOCK, { mode: 'exclusive', ifAvailable: true }, function (lock) {
              if (lock !== null && lock !== undefined) return becomeLeader()
              player.setLeader(false)
              return navigator.locks.request(LOCK, becomeLeader)
            })
            .catch(function () {
              player.setLeader(true)
            })
        } catch (error) {
          player.setLeader(true)
        }
      })

      function mount(name, registration, component) {
        ctx.effect(function () {
          var dispose = ctx.slots.inject(name, function () {
            return ctx.slots.register(registration, component)
          })
          return function () {
            if (typeof dispose === 'function') dispose()
          }
        })
      }

      mount('shell.overlay', { name: 'shell.overlay', id: 'music-player', order: 15 }, AudioHost)
      mount('shell.overlay', { name: 'shell.overlay', id: 'music-queue', order: 16 }, GlobalQueueHost)
      mount(
        'sidebar.panellist',
        {
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          label: function () {
            return t('nav.label')
          },
        },
        MusicSideIcon,
      )
      mount('main', { name: 'main', key: PANEL_ID }, function () {
        return h(MusicBoundary, null, h(Panel))
      })
      mount('conversation.input.dock', { name: 'conversation.input.dock', id: 'music-lyrics-above' }, function () {
        return h(SilentBoundary, null, h(ComposerLyrics))
      })
      mount(
        'conversation.input.right',
        { name: 'conversation.input.right', id: 'music-composer-cluster', order: 10 },
        function () {
          return h(SilentBoundary, null, h(ComposerCluster))
        },
      )
    }

    var plugin = {
      name: 'dsh-music-panel',
      inject: ['slots', 'locale'],
      apply: apply,
    }
    // Non-enumerable handles for tests and debugging; the host never sees them.
    try {
      Object.defineProperty(plugin, '__internals', {
        value: {
          uiStore: uiStore,
          libraryStore: libraryStore,
          onlineStore: onlineStore,
          prefsStore: prefsStore,
          overlayStore: overlayStore,
          selectionStore: selectionStore,
          player: player,
          lufsFromAudioBuffer: lufsFromAudioBuffer,
          analyzeLoudnessBlob: analyzeLoudnessBlob,
          mergeLyricTranslation: mergeLyricTranslation,
          buildTranslatedLrc: buildTranslatedLrc,
          formatLrcTime: formatLrcTime,
          // Pure pager math; the render mock cannot reach the paged branch.
          pageWindow: pageWindow,
          SONG_PAGE_SIZE: SONG_PAGE_SIZE,
          // Pure sidebar model, so tests can assert entries without matching
          // rendered copy (which shares words with empty-state text).
          navGroupsFor: navGroupsFor,          // Derived from UI_SOURCES; asserted so the music_control tool cannot
          // drift away from the provider list again.
          isOnlineSource: isOnlineSource,
          UI_SOURCES: UI_SOURCES,
          // Equalizer: the panel renders in tests, and the curve maths is pure.
          AudioEffectsPanel: AudioEffectsPanel,
          EqPanel: EqPanel,
          normalizeEqPrefs: normalizeEqPrefs,
          eqCurveSamples: eqCurveSamples,
          EQ_PRESETS: EQ_PRESETS,
        },
        enumerable: false,
      })
    } catch (error) {
      // Older engines without defineProperty simply skip the hook.
    }
    return plugin
  },
})
