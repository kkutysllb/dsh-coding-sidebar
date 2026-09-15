/** CSS Modules class-map declaration (tsdown compiles .module.css at build). */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

/** Plain side-effect stylesheets (the tsdown preset inlines them). */
declare module '*.css'
