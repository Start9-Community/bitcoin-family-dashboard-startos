# Updating the upstream version

The dashboard is built from the `bitcoin-family-dashboard/` git submodule
(<https://github.com/wahidsaleemi/bitcoin-family-dashboard>), pinned at an upstream
commit. The `Dockerfile` copies the page's static files out of whatever commit the submodule
points at; there is no `dockerTag`.

## Determining the upstream version

Upstream tags no releases and has no version string of its own — the package's upstream
version is the developer's, agreed with them at each release. Check for new commits:

```sh
git -C bitcoin-family-dashboard fetch origin && git -C bitcoin-family-dashboard log --oneline HEAD..origin/main
```

The pin is the submodule's recorded commit in this repo's tree.

The image base is `nginx:<version>-alpine` in the `Dockerfile`; bump it when Docker Hub's
`nginx` `-alpine` tag moves. The wallet helper's own dependencies are pinned by
`wallet-helper/package-lock.json`.

## Applying the bump

1. Move the submodule and stage the pointer:

   ```sh
   git -C bitcoin-family-dashboard checkout <commit>
   git add bitcoin-family-dashboard
   ```

2. Set `version` in `startos/versions/current.ts` to `<upstream>:0`.
3. If a `config.json` key was added or changed upstream, update `startos/fileModels/config.json.ts`
   and the action that owns the key.
