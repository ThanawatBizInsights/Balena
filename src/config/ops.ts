// The operations app's database (Supabase project "balena-ops"). Both values are public by
// design: the publishable key only lets a browser talk to the project, and every table is
// protected by row-level security, so nothing is readable without a team member's login.
// Never put the secret (service role) key here or anywhere in this repo.
export const OPS_SUPABASE = {
  url: "https://laxvaaqcnryzwvhcdsbl.supabase.co",
  publishableKey: "sb_publishable_NFcKRHOriyqoU50sWz0zMg_qegSFst4",
};
