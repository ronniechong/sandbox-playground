# packages/ui

Source of truth for components the scaffolder copies into a new experiment
(`pnpm new <slug> --with <name>`), per the "copy over couple" principle —
there is no runtime dependency between an experiment and this package. Each
file here is standalone: plain Tailwind classes, no shared state, no imports
from anywhere else in the workspace besides React itself.
