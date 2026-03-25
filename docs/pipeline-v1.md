# Client Pipeline V1

## Statuses

- `new_lead`: contact request received, no client account yet.
- `account_created`: client account created in Netlify Identity.
- `onboarding_completed`: core project information has been synced and the file is ready for human follow-up.
- `call_requested`: a discovery or follow-up call has been requested or scheduled.
- `call_done`: the call happened and notes were captured.
- `scan_scheduled`: a Matterport scan date has been proposed or confirmed.
- `scan_completed`: the scan has been completed and the Matterport asset is available.
- `analysis_ready`: analysis assets are ready, such as plans, photos, or Marcel activation.
- `avant_projet_ready`: the avant-projet is ready to be shared with the client.

## Step Meaning

- Lead capture starts when the contact form or submission webhook creates or updates a row in `clients` with `status = new_lead`.
- Account creation moves the same client row to `account_created`.
- Operational syncs can promote the row through the rest of the pipeline based on explicit `status` input or on available fields like call dates, scan dates, Matterport links, plans, photos, and avant-projet flags.

## Simple Flow

`new_lead` -> `account_created` -> `onboarding_completed` -> `call_requested` -> `call_done` -> `scan_scheduled` -> `scan_completed` -> `analysis_ready` -> `avant_projet_ready`

## Fresh Contact Submission

A fresh contact form submission should create or upsert a `clients` row with `prenom`, `nom`, `email`, `status = new_lead`, and the explicit project fields `type_bien`, `demande`, `budget`, and `echeance`.

## Canonical Client Identity

ScantoRenov canonical client identity fields are:

1. `genre`
2. `prenom`
3. `nom`
4. `email`
5. `telephone`
6. `adresse`

The physical column order in Supabase does not need to be changed. Reads and displays should use an explicit canonical select/display order based on column names, not on the physical storage order of the table.

Example canonical read order:

```sql
select
  genre,
  prenom,
  nom,
  email,
  telephone,
  adresse
from public.clients;
```
