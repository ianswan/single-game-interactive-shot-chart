// src/shotchart.js
//
// Interactive shot chart.
// Data:
//   ../data/shots.json
//
// Features:
//   - Full-court shot chart
//   - Player filter
//   - Team filter
//   - Made / missed filter
//   - Half filter
//   - Quarter filter
//   - Score situation filter
//   - Shot statistics
//   - Stable hover behavior
//   - HTML tooltip with shot details

(() => {
	"use strict";

	const CONFIG = {
		dataUrl: "data/shots.json",
		containerId: "shot-chart",

		teamNames: {
			3: "Dallas Wings",
			8: "Minnesota Lynx",
		},
	};

	const state = {
		shots: [],
		player: "all",
		team: "all",
		result: "all",
		half: "all",
		quarter: "all",
		scoreSituation: "all",
	};

	let court = null;
	let tooltip = null;

	// ------------------------------------------------------------
	// Utility
	// ------------------------------------------------------------

	function escapeHtml(value) {
		return String(value ?? "")
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#039;");
	}

	function playerName(shot) {
		return shot.player_name || `Player ${shot.player_id}`;
	}

	function teamName(teamId) {
		return CONFIG.teamNames[String(teamId)] || `Team ${teamId}`;
	}

	function uniquePlayers(shots) {
		return [...new Set(shots.map(playerName))].sort((a, b) =>
			a.localeCompare(b),
		);
	}

	function uniqueTeams(shots) {
		return [...new Set(shots.map((shot) => String(shot.team_id)))].sort(
			(a, b) => Number(a) - Number(b),
		);
	}

	// ------------------------------------------------------------
	// Score / game situation
	// ------------------------------------------------------------

	function getPeriod(shot) {
		const period = Number(shot.period);

		return Number.isFinite(period) ? period : null;
	}

	function getHalf(shot) {
		const period = getPeriod(shot);

		if (period == null) {
			return null;
		}

		if (period === 1 || period === 2) {
			return "first";
		}

		if (period === 3 || period === 4) {
			return "second";
		}

		// Overtime periods are treated as second half.
		if (period > 4) {
			return "second";
		}

		return null;
	}

	function getQuarter(shot) {
		const period = getPeriod(shot);

		if (period == null) {
			return null;
		}

		if (period >= 1 && period <= 4) {
			return String(period);
		}

		return "ot";
	}

	function getScoreDifferential(shot) {
		const homeScore = Number(shot.home_score);
		const awayScore = Number(shot.away_score);

		if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
			return null;
		}

		const teamId = String(shot.team_id);
		const homeTeamId = String(shot.home_team_id);
		const awayTeamId = String(shot.away_team_id);

		/*
		 * Calculate the score from the shooting team's perspective.
		 *
		 * Positive = shooting team is leading.
		 * Negative = shooting team is trailing.
		 * Zero = tied.
		 */
		if (teamId === homeTeamId) {
			return homeScore - awayScore;
		}

		if (teamId === awayTeamId) {
			return awayScore - homeScore;
		}

		return null;
	}

	function getScoreSituation(shot) {
		const differential = getScoreDifferential(shot);

		if (differential == null) {
			return null;
		}

		if (differential === 0) {
			return "tied";
		}

		if (differential === 1) {
			return "up1";
		}

		if (differential >= 2 && differential <= 3) {
			return "up2to3";
		}

		if (differential >= 4 && differential <= 6) {
			return "up4to6";
		}

		if (differential >= 7) {
			return "up7plus";
		}

		if (differential === -1) {
			return "down1";
		}

		if (differential >= -3 && differential <= -2) {
			return "down2to3";
		}

		if (differential >= -6 && differential <= -4) {
			return "down4to6";
		}

		if (differential <= -7) {
			return "down7plus";
		}

		return null;
	}

	// ------------------------------------------------------------
	// Filtering
	// ------------------------------------------------------------

	function matchesScoreSituation(shot) {
		if (state.scoreSituation === "all") {
			return true;
		}

		const before = Number(shot.score_diff_before);
		const pointsAttempted = Number(shot.points_attempted);

		if (
			!Number.isFinite(before) ||
			!Number.isFinite(pointsAttempted) ||
			pointsAttempted <= 0
		) {
			return false;
		}

		const afterMake = before + pointsAttempted;

		switch (state.scoreSituation) {
			case "ties_game":
				return before < 0 && afterMake === 0;

			case "takes_lead":
				return before < 0 && afterMake > 0;

			case "extends_lead":
				return before > 0 && afterMake > before;

			case "cuts_lead":
				return before < 0 && afterMake < 0 && afterMake > before;

			default:
				return false;
		}
	}

	function getFilteredShots() {
		return state.shots.filter((shot) => {
			const matchesPlayer =
				state.player === "all" || playerName(shot) === state.player;

			const matchesTeam =
				state.team === "all" || String(shot.team_id) === String(state.team);

			const matchesHalf = state.half === "all" || getHalf(shot) === state.half;

			const matchesQuarter =
				state.quarter === "all" ||
				Number(shot.period) === Number(state.quarter);

			// Made / missed is independent.
			let matchesResult = true;

			if (state.result === "made") {
				matchesResult = shot.made === true;
			}

			if (state.result === "missed") {
				matchesResult = shot.made !== true;
			}

			// Score situation is also independent.
			const matchesSituation = matchesScoreSituation(shot);

			return (
				matchesPlayer &&
				matchesTeam &&
				matchesHalf &&
				matchesQuarter &&
				matchesResult &&
				matchesSituation
			);
		});
	}

	// ------------------------------------------------------------
	// Stats
	// ------------------------------------------------------------

	function isFreeThrow(shot) {
		return /free throw/i.test(shot.description || "");
	}

	function calculateStats(shots) {
		// Free throws are intentionally excluded from field-goal statistics.
		const fieldGoalShots = shots.filter((shot) => !isFreeThrow(shot));
		const freeThrowShots = shots.filter((shot) => isFreeThrow(shot));

		// -------------------------
		// Field goals
		// -------------------------

		const attempts = fieldGoalShots.length;

		const made = fieldGoalShots.filter((shot) => shot.made === true).length;

		const missed = attempts - made;

		const points = fieldGoalShots.reduce(
			(total, shot) => total + Number(shot.points || 0),
			0,
		);

		const threeAttempts = fieldGoalShots.filter(
			(shot) => Number(shot.points_attempted) === 3,
		).length;

		const threesMade = fieldGoalShots.filter(
			(shot) => shot.made === true && Number(shot.points_attempted) === 3,
		).length;

		// -------------------------
		// Free throws
		// -------------------------

		const freeThrowAttempts = freeThrowShots.length;

		const freeThrowsMade = freeThrowShots.filter(
			(shot) => shot.made === true,
		).length;

		const freeThrowsMissed = freeThrowAttempts - freeThrowsMade;

		return {
			attempts,
			made,
			missed,
			points,

			fgPct: attempts ? (made / attempts) * 100 : 0,

			threeAttempts,
			threesMade,

			threePct: threeAttempts ? (threesMade / threeAttempts) * 100 : 0,

			freeThrowAttempts,
			freeThrowsMade,
			freeThrowsMissed,

			freeThrowPct: freeThrowAttempts
				? (freeThrowsMade / freeThrowAttempts) * 100
				: 0,
		};
	}

	// ------------------------------------------------------------
	// Tooltip
	// ------------------------------------------------------------

	function createTooltip() {
		if (tooltip) {
			return tooltip;
		}

		tooltip = document.createElement("div");

		tooltip.className = "shotchart-tooltip";

		document.body.appendChild(tooltip);

		return tooltip;
	}

	function showTooltip(shot, event) {
		const tip = createTooltip();

		const made = shot.made === true;
		const result = made ? "Made" : "Missed";

		const points = Number(shot.points || 0);

		const period = getQuarter(shot);

		const periodText = period === "ot" ? "OT" : period ? `Q${period}` : "";

		const clock = shot.clock || "";

		const distance = isFreeThrow(shot) ? null : getShotDistance(shot);

		const differential = getScoreDifferential(shot);

		let scoreText = "";

		if (differential != null) {
			if (differential === 0) {
				scoreText = "Tied";
			} else if (differential > 0) {
				scoreText = `Up ${differential}`;
			} else {
				scoreText = `Down ${Math.abs(differential)}`;
			}
		}

		tip.innerHTML = `
  <div class="shotchart-tooltip-name">
    ${escapeHtml(playerName(shot))}
  </div>

  <div class="shotchart-tooltip-result ${made ? "made" : "missed"}">
    ${result}
    ${points ? ` · ${points} pts` : ""}
  </div>

  <div class="shotchart-tooltip-detail">
    ${escapeHtml(teamName(shot.team_id))}
    ${periodText ? ` · ${periodText}` : ""}
    ${clock ? ` · ${escapeHtml(clock)}` : ""}
  </div>

  ${
		shot.home_score != null && shot.away_score != null
			? `
        <div class="shotchart-tooltip-detail">
          Score: ${escapeHtml(shot.away_score)}
          - ${escapeHtml(shot.home_score)}
          ${scoreText ? ` · ${scoreText}` : ""}
        </div>
      `
			: ""
	}

  <div class="shotchart-tooltip-detail">
    ${escapeHtml(shot.description || "")}
  </div>

  ${
		distance != null
			? `
        <div class="shotchart-tooltip-detail">
          ${distance.toFixed(1)} ft from basket
        </div>
      `
			: ""
	}
`;

		tip.style.display = "block";

		positionTooltip(event);
	}

	function hideTooltip() {
		if (tooltip) {
			tooltip.style.display = "none";
		}
	}

	function positionTooltip(event) {
		if (!tooltip) {
			return;
		}

		const gap = 14;

		const tooltipWidth = tooltip.offsetWidth;

		const tooltipHeight = tooltip.offsetHeight;

		let left = event.clientX + gap;

		let top = event.clientY + gap;

		if (left + tooltipWidth > window.innerWidth - 10) {
			left = event.clientX - tooltipWidth - gap;
		}

		if (top + tooltipHeight > window.innerHeight - 10) {
			top = event.clientY - tooltipHeight - gap;
		}

		tooltip.style.left = `${Math.max(10, left)}px`;

		tooltip.style.top = `${Math.max(10, top)}px`;
	}

	function getShotDistance(shot) {
		const x = Number(shot.x);
		const y = Number(shot.y);

		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			return null;
		}

		const basketX = x >= 0 ? 41.75 : -41.75;

		return Math.sqrt(Math.pow(x - basketX, 2) + Math.pow(y, 2));
	}

	// ------------------------------------------------------------
	// Application UI
	// ------------------------------------------------------------

	function createApp(container) {
		container.innerHTML = `
  <div class="shotchart-app">

    <div class="shotchart-controls">

      <div class="shotchart-field">
        <label for="shotchart-player">
          Player
        </label>

        <select id="shotchart-player">
          <option value="all">
            All players
          </option>
        </select>
      </div>

      <div class="shotchart-field">
        <label for="shotchart-team">
          Team
        </label>

        <select id="shotchart-team">
          <option value="all">
            All teams
          </option>
        </select>
      </div>

      <div class="shotchart-field">
        <label for="shotchart-result">
          Result
        </label>

        <select id="shotchart-result">
          <option value="all">
            All shots
          </option>

          <option value="made">
            Made
          </option>

          <option value="missed">
            Missed
          </option>
        </select>
      </div>

      <div class="shotchart-field">
        <label for="shotchart-half">
          Half
        </label>

        <select id="shotchart-half">
          <option value="all">
            All halves
          </option>

          <option value="first">
            First half
          </option>

          <option value="second">
            Second half
          </option>
        </select>
      </div>

      <div class="shotchart-field">
        <label for="shotchart-quarter">
          Quarter
        </label>

        <select id="shotchart-quarter">
          <option value="all">
            All quarters
          </option>

          <option value="1">
            Q1
          </option>

          <option value="2">
            Q2
          </option>

          <option value="3">
            Q3
          </option>

          <option value="4">
            Q4
          </option>

          <option value="ot">
            Overtime
          </option>
        </select>
      </div>

        <div class="shotchart-field">
        <label for="shotchart-score-situation">
            Score Situation
        </label>

        <select id="shotchart-score-situation">
            <option value="all">
            All situations
            </option>

            <option value="ties_game">
            Ties the game
            </option>

            <option value="takes_lead">
            Takes the lead
            </option>

            <option value="extends_lead">
            Extends the lead
            </option>

            <option value="cuts_lead">
            Cuts the lead
            </option>
        </select>
        </div>


      <button
        id="shotchart-reset"
        class="shotchart-reset"
        type="button"
      >
        Reset
      </button>

    </div>

    <div
        id="shotchart-stats"
        class="shotchart-stats"
    ></div> 

    <div class="shotchart-court-wrap">
        <div id="shotchart-court"></div>

        <div
            id="shotchart-free-throws"
            class="shotchart-free-throws"
        ></div>
        </div>

    <div class="shotchart-legend">

      <span class="shotchart-legend-item">
        <span class="shotchart-made-dot"></span>
        Made
      </span>

      <span class="shotchart-legend-item">
        <span class="shotchart-missed-dot"></span>
        Missed
      </span>

    </div>

  </div>
`;

		setupControls();
	}

	function setupControls() {
		const player = document.getElementById("shotchart-player");

		const team = document.getElementById("shotchart-team");

		const result = document.getElementById("shotchart-result");

		const half = document.getElementById("shotchart-half");

		const quarter = document.getElementById("shotchart-quarter");

		const scoreSituation = document.getElementById("shotchart-score-situation");

		const reset = document.getElementById("shotchart-reset");

		player.addEventListener("change", (event) => {
			state.player = event.target.value;
			render();
		});

		team.addEventListener("change", (event) => {
			state.team = event.target.value;
			render();
		});

		result.addEventListener("change", (event) => {
			state.result = event.target.value;
			render();
		});

		half.addEventListener("change", (event) => {
			state.half = event.target.value;
			render();
		});

		quarter.addEventListener("change", (event) => {
			state.quarter = event.target.value;
			render();
		});

		scoreSituation.addEventListener("change", (event) => {
			state.scoreSituation = event.target.value;
			render();
		});

		reset.addEventListener("click", () => {
			state.player = "all";
			state.team = "all";
			state.result = "all";
			state.half = "all";
			state.quarter = "all";
			state.scoreSituation = "all";

			player.value = "all";
			team.value = "all";
			result.value = "all";
			half.value = "all";
			quarter.value = "all";
			scoreSituation.value = "all";

			render();
		});
	}

	// ------------------------------------------------------------
	// Filters
	// ------------------------------------------------------------

	function populateFilters() {
		const playerSelect = document.getElementById("shotchart-player");

		const teamSelect = document.getElementById("shotchart-team");

		if (!playerSelect || !teamSelect) {
			return;
		}

		playerSelect.innerHTML = `
  <option value="all">
    All players
  </option>
`;

		uniquePlayers(state.shots).forEach((name) => {
			const option = document.createElement("option");

			option.value = name;
			option.textContent = name;

			playerSelect.appendChild(option);
		});

		teamSelect.innerHTML = `
  <option value="all">
    All teams
  </option>
`;

		uniqueTeams(state.shots).forEach((teamId) => {
			const option = document.createElement("option");

			option.value = teamId;
			option.textContent = teamName(teamId);

			teamSelect.appendChild(option);
		});

		playerSelect.value = state.player;
		teamSelect.value = state.team;
	}

	// ------------------------------------------------------------
	// Stats
	// ------------------------------------------------------------

	function renderStats(shots) {
		const element = document.getElementById("shotchart-stats");

		if (!element) {
			return;
		}

		const stats = calculateStats(shots);

		element.innerHTML = `
		<div class="shotchart-stat-group">
			<div class="shotchart-stat-group-title">
				Field Goals
			</div>

			<div class="shotchart-stat-grid">
				${statCard("Shots", stats.attempts)}
				${statCard("Made", stats.made)}
				${statCard("Missed", stats.missed)}
				${statCard("FG%", `${stats.fgPct.toFixed(1)}%`)}
				${statCard("3PT%", `${stats.threePct.toFixed(1)}%`)}
				${statCard("Points", stats.points)}
			</div>
		</div>

		<div class="shotchart-stat-group shotchart-ft-stats">
			<div class="shotchart-stat-group-title">
				Free Throws
			</div>

			<div class="shotchart-stat-grid">
				${statCard("Attempts", stats.freeThrowAttempts)}
				${statCard("Made", stats.freeThrowsMade)}
				${statCard("Missed", stats.freeThrowsMissed)}
				${statCard("FT%", `${stats.freeThrowPct.toFixed(1)}%`)}
			</div>
		</div>
	`;
	}

	function statCard(label, value) {
		return `
		<div class="shotchart-stat">
			<div class="shotchart-stat-label">
				${escapeHtml(label)}
			</div>

			<div class="shotchart-stat-value">
				${escapeHtml(value)}
			</div>
		</div>
	`;
	}

	// ------------------------------------------------------------
	// Render
	// ------------------------------------------------------------

	function renderFreeThrows(shots) {
		const container = document.getElementById("shotchart-free-throws");

		if (!container) {
			return;
		}

		const freeThrows = shots.filter(isFreeThrow);

		container.innerHTML = `
		<div class="shotchart-free-throw-team shotchart-free-throw-away"></div>
		<div class="shotchart-free-throw-divider"></div>
		<div class="shotchart-free-throw-team shotchart-free-throw-home"></div>
	`;

		const awayContainer = container.querySelector(".shotchart-free-throw-away");

		const homeContainer = container.querySelector(".shotchart-free-throw-home");

		const awayShots = freeThrows.filter((shot) => String(shot.team_id) === "3");

		const homeShots = freeThrows.filter((shot) => String(shot.team_id) === "8");

		function renderTeamShots(teamContainer, teamShots) {
			if (!teamShots.length) {
				return;
			}

			teamShots.forEach((shot) => {
				const marker = document.createElement("button");

				marker.type = "button";

				marker.className =
					"shotchart-free-throw-marker " +
					(shot.made === true ? "made" : "missed");

				marker.setAttribute(
					"aria-label",
					`${playerName(shot)} — ${
						shot.made === true ? "Made" : "Missed"
					} free throw`,
				);

				marker.addEventListener("mouseenter", (event) => {
					showTooltip(shot, event);
				});

				marker.addEventListener("mousemove", (event) => {
					positionTooltip(event);
				});

				marker.addEventListener("mouseleave", () => {
					hideTooltip();
				});

				teamContainer.appendChild(marker);
			});
		}

		renderTeamShots(awayContainer, awayShots);
		renderTeamShots(homeContainer, homeShots);
	}

	function render() {
		const courtContainer = document.getElementById("shotchart-court");

		if (!courtContainer) {
			return;
		}

		hideTooltip();

		const shots = getFilteredShots();

		// Free throws are rendered separately below the court.
		const fieldGoalShots = shots.filter((shot) => !isFreeThrow(shot));

		renderStats(shots);
		renderFreeThrows(shots);

		court = window.ShotChartCourt.drawCourt(courtContainer, {
			width: 1100,
			height: 590,
			showLabels: false,
		});

		window.ShotChartCourt.plotShots(court, fieldGoalShots, {
			radius: 5.8,

			madeColor: "#16a34a",
			missedColor: "#dc2626",

			opacity: 0.9,

			onHover: (shot, event) => {
				showTooltip(shot, event);
			},

			onLeave: () => {
				hideTooltip();
			},
		});

		if (!fieldGoalShots.length) {
			const empty = document.createElement("div");

			empty.className = "shotchart-empty";

			empty.textContent = "No field-goal shots match the selected filters.";

			courtContainer.appendChild(empty);
		}
	}

	// ------------------------------------------------------------
	// Data loading
	// ------------------------------------------------------------

	async function loadShots() {
		if (Array.isArray(window.SHOTS_DATA)) {
			state.shots = window.SHOTS_DATA;
			return;
		}

		const response = await fetch(CONFIG.dataUrl);

		if (!response.ok) {
			throw new Error(
				`Unable to load ${CONFIG.dataUrl} ` + `(${response.status})`,
			);
		}

		const data = await response.json();

		if (!Array.isArray(data)) {
			throw new Error("shots.json must contain a JSON array.");
		}

		state.shots = data;
	}

	// ------------------------------------------------------------
	// Init
	// ------------------------------------------------------------

	async function init() {
		const container = document.getElementById(CONFIG.containerId);

		if (!container) {
			console.error(`#${CONFIG.containerId} was not found.`);

			return;
		}

		if (!window.ShotChartCourt) {
			container.innerHTML = `
    <div class="shotchart-error">
      court.js must be loaded before
      shotchart.js.
    </div>
  `;

			return;
		}

		createApp(container);
		createTooltip();

		try {
			await loadShots();

			populateFilters();
			render();

			console.log(`Shot chart loaded ${state.shots.length} shots.`);
		} catch (error) {
			console.error(error);

			container.innerHTML = `
    <div class="shotchart-error">
      ${escapeHtml(error.message)}
    </div>
  `;
		}
	}

	// ------------------------------------------------------------
	// Public API
	// ------------------------------------------------------------

	window.ShotChart = {
		init,

		setData(shots) {
			if (!Array.isArray(shots)) {
				throw new TypeError("ShotChart.setData expects an array.");
			}

			state.shots = shots;

			state.player = "all";
			state.team = "all";
			state.result = "all";
			state.half = "all";
			state.quarter = "all";
			state.scoreSituation = "all";

			populateFilters();
			render();
		},

		getData() {
			return [...state.shots];
		},

		getFilteredData() {
			return getFilteredShots();
		},
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
