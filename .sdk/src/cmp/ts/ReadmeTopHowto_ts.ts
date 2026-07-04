
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props

  Content(`**TypeScript:**
\`\`\`ts
const result = await client.direct({
  path: '/api/resource/{id}',
  method: 'GET',
  params: { id: 'example' },
})
if (result instanceof Error) {
  throw result
}
console.log(result.data)
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
