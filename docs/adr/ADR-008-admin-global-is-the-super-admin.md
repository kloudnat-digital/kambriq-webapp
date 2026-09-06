# ADR-008 - `ADMIN_GLOBAL` is the super admin; no second all-powerful role

- **Status:** Accepted
- **Date:** 2026-09-06
- **Chantier:** `H1`
- **Cost impact:** None. No resource, no dependency, no runtime change - a
  decision, a comment and a test.

## Context

The RBAC block opened with a request for a `SUPER_ADMIN` role: a top tier that
implies every permission and can administer other administrators.

Before building one, the question worth asking is whether the codebase already
has it. It does.

### What the code says

**One.** `libs/common/src/guards/roles.guard.ts` - `ROLE_HIERARCHY[ADMIN_GLOBAL]`
lists `ADMIN_LANDS`, `ADMIN_KBS`, `ADMIN_KAMNET`, `AGENT`, `CLIENT`,
`KCA_CERTIFIED` and `CANDIDATE_KBS`. That is every role that appears in an
`@Roles()` decorator anywhere in `apps/api/src`, and every role that has a row in
the database. **There is no route in the API that `ADMIN_GLOBAL` cannot reach.**

**Two.** `apps/api/src/core/users/users.controller.ts` - the three endpoints that
change another user's roles each carry `@Roles(RoleCode.ADMIN_GLOBAL)` and
nothing else:

| Route                           | Line | What it does                                       |
| ------------------------------- | ---- | -------------------------------------------------- |
| `POST /users/:id/roles`         | 289  | grants one role                                    |
| `DELETE /users/:id/roles/:code` | 313  | revokes one role                                   |
| `PATCH /users/:id`              | 259  | replaces the whole role set (`AdminUpdateUserDto`) |

Nothing in any of them excludes `ADMIN_GLOBAL` from the roles that can be granted
or revoked. **`ADMIN_GLOBAL` can already appoint and unappoint administrators,
including other holders of itself.**

Those two properties - implies everything, administers administrators - are the
whole definition of a super admin. The role exists. It is called `ADMIN_GLOBAL`.

The `RoleCode` enum also carries `STAFF_VERIFY`, `STAFF_VALUATION` and
`PARTNER_GEO`. They are placeholders for VERIFY, VALUATION and KCPI: no row in
the database, no `@Roles()` decorator, no entry in the hierarchy. They gate
nothing, so they cannot create a route the super admin is refused. The day one of
them gates something, the guard below fails until the hierarchy is updated - and
that is exactly when the decision needs re-reading.

## Decision

**`ADMIN_GLOBAL` is the super admin. No `SUPER_ADMIN` role is created.**

`SUPER_ADMIN_ROLE` is exported from `libs/common/src/guards/roles.guard.ts` as an
alias of `RoleCode.ADMIN_GLOBAL`, so code that means "the top of the hierarchy"
can say so without re-deriving it, and so a future promotion of the top tier is
one line rather than a sweep.

## Why not both

Two all-powerful roles is not redundancy. It is a permission model with two
answers to "who can do this", and they drift, because nothing forces them apart
and nothing forces them together:

- the next `@Roles()` names one of them and not the other. Nothing fails. The
  symptom is a person with the other role being refused a route they own, months
  later, and the diagnosis starts from "but they are an admin";
- every guard that has to protect the top tier - H4's "the last super admin
  cannot be removed" - has to count holders of a set rather than of a role, and a
  count over a set is one forgotten member from being wrong in the direction that
  locks everybody out;
- the seed, the bootstrap and the register each have to say which one they mean,
  and the answer stops being obvious the first time somebody holds one and not
  the other.

The failure mode is the one this repo keeps meeting: **nothing reports an error.**
The model simply stops meaning what people think it means, and the first symptom
is an incident.

## Consequences

**H1 is documentation and a guard, not new code.** No migration, no new role row,
no change to any decorator.

The guard is `apps/api/src/__test__/conventions/super-admin.spec.ts`. It fails if:

- any role named in an `@Roles()` decorator is not implied by `SUPER_ADMIN_ROLE`
  (a route the super admin cannot reach);
- any other role implies `SUPER_ADMIN_ROLE` (a second way to become the top);
- any other role reaches every route-guarding role except `ADMIN_GLOBAL` itself
  (a god role in everything but name);
- any of the three role-mutation routes loses its `@Roles`, or gains a second
  role beside `ADMIN_GLOBAL`.

Each of those five was mutated and watched failing on its own; the runs are
quoted in the register entry for `H1`.

### Revisit when

A role appears that must administer other administrators **without** being able
to reach every product route - a security officer who can grant and revoke but
cannot read land files, say. That is a real second tier and it is not what was
asked for here. It would be a new ADR, superseding this one, and its first job
would be to say which of the two counts as "the last super admin" for H4.
