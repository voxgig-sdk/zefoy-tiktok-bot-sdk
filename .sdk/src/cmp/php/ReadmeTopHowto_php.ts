
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props

  Content(`**PHP:**
\`\`\`php
$result = $client->direct([
    "path" => "/api/resource/{id}",
    "method" => "GET",
    "params" => ["id" => "example"],
]);
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
