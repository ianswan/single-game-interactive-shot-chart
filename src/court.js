// src/court.js
//
// Full WNBA basketball court renderer.
// Shot coordinates use a 94 x 50 foot coordinate system:
//   x: -47 ... +47
//   y: -25 ... +25
//
// Baskets:
//   left  = -41.75, 0
//   right =  41.75, 0
//
// WNBA three-point distance:
//   22 ft 1.75 in = 22.1458 ft

(() => {
	"use strict";

	const COURT = {
		width: 94,
		height: 50,

		left: -47,
		right: 47,
		top: -25,
		bottom: 25,

		basketOffset: 41.75,

		// WNBA three-point distance.
		threePointRadius: 22 + 1.75 / 12,

		// The corner three line is 22 feet from the center line.
		threePointCornerY: 22,

		freeThrowDistance: 13.5,

		// 16 ft wide WNBA paint.
		paintHalfWidth: 8,

		// 6 ft free-throw circle.
		freeThrowCircleRadius: 6,

		// 4 ft restricted area / charge semicircle.
		restrictedAreaRadius: 4,

		// 18 in diameter rim.
		rimRadius: 0.75,

		// Backboard
		backboardDistance: 1,
		backboardHalfWidth: 3,
	};

	function createSvgElement(tag, attrs = {}) {
		const element = document.createElementNS("http://www.w3.org/2000/svg", tag);

		for (const [key, value] of Object.entries(attrs)) {
			element.setAttribute(key, value);
		}

		return element;
	}

	function courtX(x, width) {
		return ((x - COURT.left) / COURT.width) * width;
	}

	function courtY(y, height) {
		return ((y - COURT.top) / COURT.height) * height;
	}

	function drawLine(svg, x1, y1, x2, y2, attrs = {}) {
		const line = createSvgElement("line", {
			x1,
			y1,
			x2,
			y2,
			...attrs,
		});

		svg.appendChild(line);
		return line;
	}

	function drawRect(svg, x, y, width, height, attrs = {}) {
		const rect = createSvgElement("rect", {
			x,
			y,
			width,
			height,
			...attrs,
		});

		svg.appendChild(rect);
		return rect;
	}

	function drawCircle(svg, cx, cy, r, attrs = {}) {
		const circle = createSvgElement("circle", {
			cx,
			cy,
			r,
			...attrs,
		});

		svg.appendChild(circle);
		return circle;
	}

	function drawCourt(container, options = {}) {
		if (!container) {
			throw new Error("drawCourt: container is required.");
		}

		const { width = 1100, height = 590, showLabels = false } = options;

		container.innerHTML = "";

		const svg = createSvgElement("svg", {
			class: "shotchart-court",
			viewBox: `0 0 ${width} ${height}`,
			width: "100%",
			height: "100%",
			preserveAspectRatio: "xMidYMid meet",
		});

		const sx = width / COURT.width;
		const sy = height / COURT.height;

		// Use one scale for circular court features so they remain
		// true circles even if the SVG is resized slightly.
		const circleScale = Math.min(sx, sy);

		const lineStyle = {
			fill: "none",
			stroke: "#8e7258",
			"stroke-width": 1.35,
		};

		// ------------------------------------------------------------------
		// Court surface
		// ------------------------------------------------------------------

		drawRect(svg, 0, 0, width, height, {
			fill: "#f4f0e8",
		});

		// Outer boundary.
		drawRect(svg, 0, 0, width, height, {
			fill: "none",
			stroke: "#80664d",
			"stroke-width": 1.8,
		});

		// Center line.
		drawLine(svg, courtX(0, width), 0, courtX(0, width), height, lineStyle);

		// Center circle.
		drawCircle(
			svg,
			courtX(0, width),
			courtY(0, height),
			6 * circleScale,
			lineStyle,
		);

		// ------------------------------------------------------------------
		// Draw one complete end of the court.
		// ------------------------------------------------------------------

		function drawBasketEnd(side) {
			const direction = side === "right" ? 1 : -1;

			const basketX = direction * COURT.basketOffset;

			const freeThrowX =
				direction * (COURT.basketOffset - COURT.freeThrowDistance);

			const paintX = direction === 1 ? 28 : -28;

			const paintLeft = direction === 1 ? 28 : -47;
			const paintRight = direction === 1 ? 47 : -28;

			const paintTop = -COURT.paintHalfWidth;
			const paintBottom = COURT.paintHalfWidth;

			// --------------------------------------------------------------
			// Paint.
			// --------------------------------------------------------------

			drawRect(
				svg,
				courtX(Math.min(paintLeft, paintRight), width),
				courtY(paintTop, height),
				Math.abs(courtX(paintRight, width) - courtX(paintLeft, width)),
				courtY(paintBottom, height) - courtY(paintTop, height),
				{
					fill: "rgba(196, 65, 50, 0.055)",
					stroke: "#8e7258",
					"stroke-width": 1.35,
				},
			);

			// --------------------------------------------------------------
			// Free throw line.
			// --------------------------------------------------------------

			drawLine(
				svg,
				courtX(paintX, width),
				courtY(paintTop, height),
				courtX(paintX, width),
				courtY(paintBottom, height),
				lineStyle,
			);

			// --------------------------------------------------------------
			// Free throw circle.
			//
			// The circle is centered on the free throw line. It is kept as
			// a true circle using the same scale in both directions.
			// --------------------------------------------------------------

			drawCircle(
				svg,
				courtX(freeThrowX, width),
				courtY(0, height),
				COURT.freeThrowCircleRadius * circleScale,
				{
					fill: "none",
					stroke: "#8e7258",
					"stroke-width": 1.35,
				},
			);

			// --------------------------------------------------------------
			// Restricted / charge semicircle.
			//
			// This should NOT be a complete circle. The basket is the
			// center, and only the court-facing half of the 4 ft arc is
			// visible.
			// --------------------------------------------------------------

			const restrictedRadius = COURT.restrictedAreaRadius * circleScale;

			const restrictedCenterX = courtX(basketX, width);
			const restrictedCenterY = courtY(0, height);

			const restrictedPath = createSvgElement("path", {
				fill: "none",
				stroke: "#8e7258",
				"stroke-width": 1.35,
			});

			const restrictedTopY = restrictedCenterY + restrictedRadius;

			const restrictedBottomY = restrictedCenterY - restrictedRadius;

			// Draw the semicircle extending toward the court.
			if (side === "right") {
				restrictedPath.setAttribute(
					"d",
					[
						`M ${restrictedCenterX} ${restrictedTopY}`,
						`A ${restrictedRadius} ${restrictedRadius} 0 0 1 ${restrictedCenterX} ${restrictedBottomY}`,
					].join(" "),
				);
			} else {
				restrictedPath.setAttribute(
					"d",
					[
						`M ${restrictedCenterX} ${restrictedTopY}`,
						`A ${restrictedRadius} ${restrictedRadius} 0 0 0 ${restrictedCenterX} ${restrictedBottomY}`,
					].join(" "),
				);
			}

			svg.appendChild(restrictedPath);

			// --------------------------------------------------------------
			// Backboard.
			//
			// The backboard sits exactly 4 ft behind the basket.
			// --------------------------------------------------------------

			const backboardX = basketX + direction * COURT.backboardDistance;

			drawLine(
				svg,
				courtX(backboardX, width),
				courtY(-COURT.backboardHalfWidth, height),
				courtX(backboardX, width),
				courtY(COURT.backboardHalfWidth, height),
				{
					stroke: "#554536",
					"stroke-width": 2.2,
					"stroke-linecap": "butt",
				},
			);

			// --------------------------------------------------------------
			// Basket / rim.
			//
			// The rim is an 18-inch diameter circle centered exactly on
			// the basket coordinate.
			// --------------------------------------------------------------

			drawCircle(
				svg,
				courtX(basketX, width),
				courtY(0, height),
				COURT.rimRadius * circleScale,
				{
					fill: "none",
					stroke: "#d75a32",
					"stroke-width": 2,
				},
			);

			// --------------------------------------------------------------
			// Three-point line.
			//
			// Two straight corner sections + one circular arc.
			// --------------------------------------------------------------

			const r = COURT.threePointRadius;
			const cornerY = COURT.threePointCornerY;

			const dx = Math.sqrt(Math.max(0, r * r - cornerY * cornerY));

			const arcX = basketX - direction * dx;

			const cornerStartX = basketX - direction * dx;

			const arcStartX = cornerStartX;

			const arcEndX = basketX - direction * r;

			const arcStartScreenX = courtX(arcStartX, width);
			const arcEndScreenX = courtX(arcEndX, width);

			const topY = courtY(-cornerY, height);
			const bottomY = courtY(cornerY, height);

			const basketScreenX = courtX(basketX, width);
			const basketScreenY = courtY(0, height);

			const radiusX = r * sx;
			const radiusY = r * sy;

			const path = createSvgElement("path", {
				fill: "none",
				stroke: "#8e7258",
				"stroke-width": 1.5,
			});

			if (side === "right") {
				path.setAttribute(
					"d",
					[
						`M ${courtX(47, width)} ${topY}`,
						`L ${arcStartScreenX} ${topY}`,
						`A ${radiusX} ${radiusY} 0 0 0 ${arcEndScreenX} ${basketScreenY}`,
						`A ${radiusX} ${radiusY} 0 0 0 ${arcStartScreenX} ${bottomY}`,
						`L ${courtX(47, width)} ${bottomY}`,
					].join(" "),
				);
			} else {
				path.setAttribute(
					"d",
					[
						`M ${courtX(-47, width)} ${topY}`,
						`L ${arcStartScreenX} ${topY}`,
						`A ${radiusX} ${radiusY} 0 0 1 ${arcEndScreenX} ${basketScreenY}`,
						`A ${radiusX} ${radiusY} 0 0 1 ${arcStartScreenX} ${bottomY}`,
						`L ${courtX(-47, width)} ${bottomY}`,
					].join(" "),
				);
			}

			svg.appendChild(path);

			if (showLabels) {
				const label = createSvgElement("text", {
					x: courtX(side === "right" ? 45 : -45, width),
					y: courtY(23.5, height),
					"text-anchor": side === "right" ? "end" : "start",
					"font-size": 11,
					"font-family": "system-ui, sans-serif",
					fill: "#8e7258",
				});

				label.textContent = side === "right" ? "RIGHT BASKET" : "LEFT BASKET";

				svg.appendChild(label);
			}
		}

		// Both baskets.
		drawBasketEnd("left");
		drawBasketEnd("right");

		container.appendChild(svg);

		return {
			svg,
			width,
			height,
			scaleX: sx,
			scaleY: sy,

			courtX: (x) => courtX(x, width),
			courtY: (y) => courtY(y, height),
		};
	}

	function plotShot(court, shot, options = {}) {
		if (!court || !court.svg || !shot) {
			return null;
		}

		const {
			radius = 5.8,
			madeColor = "#16a34a",
			missedColor = "#dc2626",
			opacity = 0.9,
			onHover = null,
			onLeave = null,
		} = options;

		const x = Number(shot.x);
		const y = Number(shot.y);

		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			return null;
		}

		const cx = court.courtX(x);
		const cy = court.courtY(y);

		const made = shot.made === true;
		const color = made ? madeColor : missedColor;

		// IMPORTANT:
		// Do NOT use transform: scale() or transform-origin here.
		// That was the source of the weird movement when hovering.
		const group = createSvgElement("g", {
			class: "shot-marker",
			"data-shot-id": shot.id ?? "",
			"data-player": shot.player_name || "",
			"data-team": shot.team_id ?? "",
			"data-made": String(made),
		});

		group.style.cursor = "pointer";
		group.style.opacity = String(opacity);

		if (made) {
			const circle = createSvgElement("circle", {
				cx,
				cy,
				r: radius,
				fill: color,
				stroke: "#ffffff",
				"stroke-width": 1.4,
			});

			group.appendChild(circle);
		} else {
			const circle = createSvgElement("circle", {
				cx,
				cy,
				r: radius,
				fill: "#ffffff",
				stroke: color,
				"stroke-width": 2,
			});

			group.appendChild(circle);

			const line1 = createSvgElement("line", {
				x1: cx - radius * 0.55,
				y1: cy - radius * 0.55,
				x2: cx + radius * 0.55,
				y2: cy + radius * 0.55,
				stroke: color,
				"stroke-width": 1.7,
				"stroke-linecap": "round",
			});

			const line2 = createSvgElement("line", {
				x1: cx + radius * 0.55,
				y1: cy - radius * 0.55,
				x2: cx - radius * 0.55,
				y2: cy + radius * 0.55,
				stroke: color,
				"stroke-width": 1.7,
				"stroke-linecap": "round",
			});

			group.appendChild(line1);
			group.appendChild(line2);
		}

		// Attach the original shot to the DOM node.
		group.__shot = shot;

		if (typeof onHover === "function") {
			group.addEventListener("mouseenter", (event) => {
				onHover(shot, event);
			});
		}

		if (typeof onLeave === "function") {
			group.addEventListener("mouseleave", (event) => {
				onLeave(shot, event);
			});
		}

		court.svg.appendChild(group);

		return group;
	}

	function clearShots(court) {
		if (!court?.svg) {
			return;
		}

		court.svg
			.querySelectorAll(".shot-marker")
			.forEach((marker) => marker.remove());
	}

	function plotShots(court, shots, options = {}) {
		clearShots(court);

		if (!Array.isArray(shots)) {
			return [];
		}

		return shots.map((shot) => plotShot(court, shot, options));
	}

	window.ShotChartCourt = {
		COURT,
		drawCourt,
		plotShot,
		plotShots,
		clearShots,
		courtX,
		courtY,
	};
})();
