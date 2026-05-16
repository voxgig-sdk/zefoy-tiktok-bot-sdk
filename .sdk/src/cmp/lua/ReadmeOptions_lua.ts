
import { cmp, each, Content } from '@voxgig/sdkgen'


const ReadmeOptions = cmp(function ReadmeOptions(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const publishedOptions = each(target.options).filter((option: any) => option.publish)
  if (0 === publishedOptions.length) {
    return
  }

  Content(`

## Options

Pass options when creating a client instance:

`)

  Content(`\`\`\`lua
local client = sdk.new({
`)

  publishedOptions.map((option: any) => {
    if ('apikey' === option.name) {
      Content(`  ${option.name} = os.getenv("${model.NAME}_APIKEY"),
`)
    }
    else {
      Content(`  -- ${option.name} = ${option.kind === 'string' ? '"..."' : '...'},
`)
    }
  })

  Content(`})
\`\`\`

`)

  Content(`| Option | Type | Description |
| --- | --- | --- |
`)

  publishedOptions.map((option: any) => {
    Content(`| \`${option.name}\` | \`${option.kind}\` | ${option.short} |
`)
  })

  Content(`
`)
})


export {
  ReadmeOptions
}
