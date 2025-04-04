net.HTTPClient():request("http://",{
  options={
    method="GET",
    headers={
      ["Content-Type"]="application/json",
      ["Accept"]="application/json"
    },
  },
  success = function(response)
    if response.status == 200 then
      local data = json.decode(response.data)
      self:debug("response:", data)
    else
      self:debug("error:", response.status, response.data)
    end
  end,
  error = function(err)
    self:debug("error:", err)
  end,
})