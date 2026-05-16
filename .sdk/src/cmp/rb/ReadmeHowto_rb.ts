
import { cmp, Content, isAuthActive } from '@voxgig/sdkgen'


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${model.NAME}_APIKEY=<your-key>`
    : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`ruby
result, err = client.direct({
  "path" => "/api/resource/{id}",
  "method" => "GET",
  "params" => { "id" => "example" },
})
raise err if err

if result["ok"]
  puts result["status"]  # 200
  puts result["data"]    # response body
end
\`\`\`

### Prepare a request without sending it

\`\`\`ruby
fetchdef, err = client.prepare({
  "path" => "/api/resource/{id}",
  "method" => "DELETE",
  "params" => { "id" => "example" },
})
raise err if err

puts fetchdef["url"]
puts fetchdef["method"]
puts fetchdef["headers"]
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required:

\`\`\`ruby
client = ${model.const.Name}SDK.test(nil, nil)

result, err = client.${model.const.Name}(nil).load(
  { "id" => "test01" }, nil
)
# result contains mock response data
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own function:

\`\`\`ruby
mock_fetch = ->(url, init) {
  return {
    "status" => 200,
    "statusText" => "OK",
    "headers" => {},
    "json" => ->() { { "id" => "mock01" } },
  }, nil
}

client = ${model.const.Name}SDK.new({
  "base" => "http://localhost:8080",
  "system" => {
    "fetch" => mock_fetch,
  },
})
\`\`\`

### Run live tests

Create a \`.env.local\` file at the project root:

\`\`\`
${model.NAME}_TEST_LIVE=TRUE${apikeyEnvLine}
\`\`\`

Then run:

\`\`\`bash
cd rb && ruby -Itest -e "Dir['test/*_test.rb'].each { |f| require_relative f }"
\`\`\`

`)

})


export {
  ReadmeHowto
}
