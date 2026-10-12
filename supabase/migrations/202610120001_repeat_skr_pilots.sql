-- Preserve each completed pilot and its transaction receipt while allowing
-- another explicitly announced, operator-supervised pilot on a new round.
-- round_id remains the primary key, so the payout flow is still one per round.
alter table public.hundo_skr_pilots drop column pilot_slot;
