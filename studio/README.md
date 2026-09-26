# kambriq Studio

The Sanity Studio for kambriq. It is deployed to Sanity's own hosting and is
never built, installed or shipped by this repository's images.

## Why it sits outside the workspace

`pnpm-workspace.yaml` lists `apps/web` only, and `.nxignore` hides this folder
from the Nx graph. `sanity` and its dependencies are several hundred megabytes,
and every quality job, every image build and every journey run installs the root
workspace. A Studio that nothing here builds must not be in anybody's install.

The price is a second lockfile and a separate install:

```sh
cd studio && pnpm install --ignore-workspace
```

`--ignore-workspace` is required. Without it pnpm walks up, finds the workspace
root and refuses.

## First set-up, once per project

```sh
cd studio
pnpm install --ignore-workspace
npx sanity login
npx sanity projects create kambriq      # prints the project id
cp .env.example .env                    # then fill in SANITY_STUDIO_PROJECT_ID
```

**Not `sanity init`.** It scaffolds a studio of its own into a new directory -
`studio/kambriq/`, with its own `sanity.config.ts` and an empty schema - and the
codebase here is already that studio. The scaffold is harmless until somebody
runs `sanity deploy` from it, at which point editors get a Studio with none of
these documents in it. `sanity projects create` creates the project and nothing
else.

`sanity init` writes the project id it created. Put it in `.env`, and in the
repository's own environment as `NEXT_PUBLIC_SANITY_PROJECT_ID`, with
`NEXT_PUBLIC_SANITY_DATASET` beside it. The web build reads both: the project
scopes `https://cdn.sanity.io/images/<projectId>/` in `img-src` and in the image
optimizer's allowlist, and the pair is what the pages query. Without the project
id the asset host is refused and every CMS page answers 404, which is the
intended default; with a project and no dataset the build fails rather than
guessing `production`.

## Running and deploying

```sh
pnpm validate            # sanity schema validate
pnpm dev                 # http://localhost:3333
pnpm deploy              # https://<SANITY_STUDIO_HOST>.sanity.studio
```

**`pnpm build` does not validate the schema.** It bundles one. A `divider`
object with no fields built clean, exited 0, and produced a Studio that showed
"Schema errors" on the first page load. `pnpm validate` is the command that
answers, and it is worth running before every deploy.

After the first deploy, set `SANITY_STUDIO_ORIGIN` on the **web** build to the
deployed origin if Sanity's Presentation tool is ever enabled. That variable is
read by `apps/web/next.config.ts`, not by this Studio, despite the prefix.

## The publish webhook

Deliveries are what fill the policy archive. Do not create the webhook by hand:

```sh
cd ..
SANITY_PROJECT_ID=... SANITY_MANAGE_TOKEN=... SANITY_WEBHOOK_SECRET=... \
  KAMBRIQ_API_URL=https://dev.api.kambriq.com \
  npx tsx scripts/sanity/upsert-policy-webhook.ts
```

The filter, the projection and the name come from
`libs/common/src/cms/legal-policy.ts`, which is also what the API's DTO is built
from. `--check` reports what is configured without writing anything.

## Loading the initial content

The site's pages used to be mdx under `apps/web/src/content`. Wave 7 converted
them and deleted the markdown; the conversion is committed as ndjson and is
loaded once, into a dataset that does not yet hold these documents:

```sh
cd studio
npx sanity dataset import ../scripts/sanity/content/initial-content.ndjson \
  --dataset production
```

From `studio/`, so the local `sanity` is used rather than one npx downloads, and
the path resolves. `--dataset` rather than a positional argument, which the CLI
deprecates.

Sixteen documents, and the import creates them published - so the policy
webhook fires and the archive gets its first rows, which is how `PolicySnapshot`
stops being empty.

**Do not re-import over live documents.** After the first load the dataset is
the content and that file is only the state it started from.

If a load went in under the old dotted ids, remove those documents first - they
are unreachable by the structure and by delivery, and nothing about them looks
wrong in the Studio:

```sh
cd studio
npx sanity documents delete --dataset production \
  legalPolicy.legal-mentions.fr legalPolicy.legal-mentions.en \
  legalPolicy.legal-privacy.fr legalPolicy.legal-privacy.en \
  legalPolicy.legal-rgpd.fr legalPolicy.legal-rgpd.en \
  legalPolicy.legal-terms.fr legalPolicy.legal-terms.en \
  contentPage.about.fr contentPage.about.en \
  contentPage.methode.fr contentPage.methode.en \
  contentPage.plan.fr contentPage.plan.en \
  contentPage.verify.fr contentPage.verify.en
```

## The documents

Sixteen: four policies and four editorial pages, each in two languages, opened by
id from the structure. There is no create button for them, because a second
French privacy policy would leave the archive with two rows claiming to be the
current version, and a second `about` would be a page nobody ever sees.

**Document ids carry no dots, and that is not cosmetic.** In a public dataset
Sanity treats any `_id` containing a period as private - the same rule that hides
`drafts.*` - so a dotted id is readable only with a token, and the site's client
sends none. The first scheme here was `legalPolicy.legal-privacy.fr`: it imported
cleanly, the Studio listed everything, and every page on the site answered 404.
Ids are `legalPolicy-<slug>-<language>` and `contentPage-<slug>-<language>`.

Adding one means adding its slug in **both** the Studio schema
(`schemaTypes/legalPolicy.ts` or `schemaTypes/contentPage.ts`) and
`libs/common/src/cms/`, plus a page under `apps/web/src/app/[locale]/`.
`studio-schema-matches-the-contract.spec.ts` fails when the two disagree.

The block styles, marks and list kinds an editor is offered are in
`schemaTypes/richText.ts` and are pinned to the same contract. They are
deliberately narrower than Sanity's defaults: the site styles those and no
others, and a style it does not style renders unstyled without anything
reporting it.

## The three KAMBRIQ labels are not editable here

TFL, VEFL and VEFIL come from `libs/common/src/kbs/label-definitions.ts` and are
placed on a page with the **Les trois labels KAMBRIQ** block, which carries no
text of its own. The KBS question bank is pinned to those same values; a wording
an editor could change here would be the same fact in two places with nothing
comparing them. Changing a definition is a code change, and it fails
`kbs-label-definitions.spec.ts` until somebody has read the bank against the new
text.
