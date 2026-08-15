library(wehoop)
library(dplyr)
library(jsonlite)

game_id <- "401857130"

game <- espn_wnba_game_all(game_id)

shots <- game$Plays |>
  filter(shooting_play == TRUE) |>

  mutate(
    # ------------------------------------------------------------
    # Half
    # ------------------------------------------------------------

    half = case_when(
      period_number %in% c(1, 2) ~ 1,
      period_number %in% c(3, 4) ~ 2,
      period_number >= 5 ~ 3,   # overtime
      TRUE ~ NA_real_
    ),

    # ------------------------------------------------------------
    # Score differential
    #
    # From the SHOOTING TEAM'S perspective.
    #
    # +2 = shooting team is up 2
    #  0 = tied
    # -1 = shooting team is down 1
    # ------------------------------------------------------------

    score_diff_after = case_when(
      team_id == home_team_id ~ home_score - away_score,
      team_id == away_team_id ~ away_score - home_score,
      TRUE ~ NA_real_
    ),

    # ESPN's score is the score after the play.
    # So subtract the points scored on this play to get
    # the score differential BEFORE the shot.

    score_diff_before = score_diff_after - case_when(
      team_id == home_team_id ~ score_value,
      team_id == away_team_id ~ score_value,
      TRUE ~ 0
    ),

    # ------------------------------------------------------------
    # Useful categorical labels
    # ------------------------------------------------------------

    score_state_before = case_when(
      score_diff_before == 0 ~ "tied",
      score_diff_before == -1 ~ "down_1",
      score_diff_before == -2 ~ "down_2",
      score_diff_before < -2 ~ "down_3_plus",
      score_diff_before == 1 ~ "up_1",
      score_diff_before == 2 ~ "up_2",
      score_diff_before > 2 ~ "up_3_plus",
      TRUE ~ NA_character_
    ),

    score_state_after = case_when(
      score_diff_after == 0 ~ "tied",
      score_diff_after == -1 ~ "down_1",
      score_diff_after == -2 ~ "down_2",
      score_diff_after < -2 ~ "down_3_plus",
      score_diff_after == 1 ~ "up_1",
      score_diff_after == 2 ~ "up_2",
      score_diff_after > 2 ~ "up_3_plus",
      TRUE ~ NA_character_
    ),

    # ------------------------------------------------------------
    # Result of the shot
    # ------------------------------------------------------------

    score_event = case_when(

      # Only made shots can change these states.
      scoring_play == TRUE & score_diff_before == 0 &
        score_diff_after > 0 ~ "takes_lead",

      scoring_play == TRUE & score_diff_before < 0 &
        score_diff_after == 0 ~ "ties_game",

      scoring_play == TRUE & score_diff_before < 0 &
        score_diff_after > 0 ~ "takes_lead",

      scoring_play == TRUE & score_diff_before > 0 &
        score_diff_after > 0 ~ "extends_lead",

      scoring_play == TRUE & score_diff_before < 0 &
        score_diff_after < 0 ~ "cuts_deficit",

      TRUE ~ "no_change"
    )
  ) |>

  transmute(
    id = id,

    home_score = home_score,
    away_score = away_score,

    player_id = athlete_id_1,
    team_id = team_id,
    player = athlete_id_1,

    x = coordinate_x,
    y = coordinate_y,

    made = scoring_play,
    points = score_value,
    points = score_value,
    points_attempted = points_attempted,

    # Game timing
    period = period_number,
    half = half,
    clock = clock_display_value,

    # Score context
    score_diff_before = score_diff_before,
    score_diff_after = score_diff_after,
    score_state_before = score_state_before,
    score_state_after = score_state_after,
    score_event = score_event,

    description = text
  ) |>

  filter(
    !is.na(x),
    !is.na(y)
  )


# ------------------------------------------------------------

# Player names

#

# Uses the Player section from espn_wnba_game_all().

# This is game-specific and gives the athlete ID -> name

# mapping needed for the shot chart.

# ------------------------------------------------------------

players <- game$Player |>
    select(
        player_id = athlete_id,
        player_name = athlete_display_name
    ) |>
    distinct(player_id, .keep_all = TRUE)

shots <- shots |>
    left_join(
        players,
        by = "player_id"
    ) |>
    mutate(
        player_name = if_else(
        is.na(player_name),
        paste0("Player ", player_id),
        player_name
    )
)

# ------------------------------------------------------------
# Write data
# ------------------------------------------------------------

write_json(
  game,
  "data/game_raw.json",
  pretty = TRUE,
  auto_unbox = TRUE
)

write_json(
  shots,
  "data/shots.json",
  pretty = TRUE,
  auto_unbox = TRUE
)
