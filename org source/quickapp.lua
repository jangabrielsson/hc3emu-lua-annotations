_emu = _emu
_print = print

local fmt = string.format

-- Overrides the global print function to use fibaro.debug for logging
-- @param ... - Arguments to be logged
function print(...) fibaro.debug(__TAG,...) end

-- Creates a class constructor function that supports inheritance
-- @param name - The name of the class to create
-- @return A function that can be used to set up inheritance
function class(name) end

plugin = plugin or {}
-- Retrieves a device by its ID
-- @param deviceId - The ID of the device to retrieve
-- @return Device object from the HC3 API
function plugin.getDevice(deviceId) return api.get("/devices/"..deviceId) end

-- Deletes a device by its ID
-- @param deviceId - The ID of the device to delete
-- @return Result of the delete operation
function plugin.deleteDevice(deviceId) return api.delete("/devices/"..deviceId) end

-- Gets a specific property of a device
-- @param deviceId - The ID of the device
-- @param propertyName - The name of the property to retrieve
-- @return The property value
function plugin.getProperty(deviceId, propertyName) return api.get("/devices/"..deviceId).properties[propertyName] end

-- Gets all child devices of a parent device
-- @param deviceId - The ID of the parent device
-- @return Array of child device objects
function plugin.getChildDevices(deviceId) return api.get("/devices?parentId="..deviceId) end

-- Creates a new child device
-- @param opts - Options for creating the child device
-- @return The created child device object
function plugin.createChildDevice(opts) return api.post("/plugins/createChildDevice", opts) end

-- Restarts a QuickApp plugin
-- @param id - The device ID to restart (optional, defaults to mainDeviceId)
-- @return Result of the restart operation
function plugin.restart(id) return api.post("/plugins/restart",{deviceId=id or plugin.mainDeviceId}) end

class 'QuickAppBase'
-- Constructor for QuickAppBase class
-- @param dev - Device object containing device properties and metadata
function QuickAppBase:__init(dev)
  self.id = dev.id
  self.type = dev.type
  self.name = dev.name
  self.enabled = dev.enabled
  self.parentId = dev.parentId
  self.roomID = dev.roomID
  self.properties = dev.properties
  self.interfaces = dev.interfaces
  self.properties = table.copy(dev.properties)
  self.uiCallbacks = {}
end

-- Logs a debug message with the device tag
-- @param ... - Arguments to be logged
function QuickAppBase:debug(...) fibaro.debug(__TAG,...) end

-- Logs a trace message with the device tag
-- @param ... - Arguments to be logged
function QuickAppBase:trace(...) fibaro.trace(__TAG,...) end

-- Logs a warning message with the device tag
-- @param ... - Arguments to be logged
function QuickAppBase:warning(...) fibaro.warning(__TAG,...) end

-- Logs an error message with the device tag
-- @param ... - Arguments to be logged
function QuickAppBase:error(...) fibaro.error(__TAG,...) end

-- Registers a UI callback function for a specific element and event type
-- @param elm - The UI element name
-- @param typ - The event type (e.g., "onReleased", "onChanged")
-- @param fun - The callback function to register
function QuickAppBase:registerUICallback(elm, typ, fun) end

-- Sets up UI callbacks based on device properties
-- Reads uiCallbacks from device properties and registers them
function QuickAppBase:setupUICallbacks() end

QuickAppBase.registerUICallbacks = QuickAppBase.setupUICallbacks

-- Calls an action method on the QuickApp if it exists
-- @param name - The name of the action/method to call
-- @param ... - Arguments to pass to the action method
-- @return Result of the action method or nil if method doesn't exist
function QuickAppBase:callAction(name, ...) end

-- Updates a device property and sends the update to the HC3 system
-- @param name - The name of the property to update
-- @param value - The new value for the property
function QuickAppBase:updateProperty(name,value) end

-- Updates a UI view element property
-- @param elm - The UI element name
-- @param prop - The property name to update
-- @param value - The new value for the property
function QuickAppBase:updateView(elm,prop,value) end

-- Checks if the device has a specific interface
-- @param name - The interface name to check for
-- @return True if the device has the interface, false otherwise
function QuickAppBase:hasInterface(name) end

-- Adds new interfaces to the device
-- @param values - Table of interface names to add
function QuickAppBase:addInterfaces(values) end

-- Removes interfaces from the device
-- @param values - Table of interface names to remove
function QuickAppBase:deleteInterfaces(values) end

-- Updates device interfaces via API call
-- @param action - The action to perform ("add" or "delete")
-- @param interfaces - Table of interfaces to add or remove
function QuickAppBase:updateInterfaces(action, interfaces) end

-- Sets the device name
-- @param name - The new name for the device
function QuickAppBase:setName(name) end

-- Sets the device enabled state
-- @param enabled - Boolean indicating if device should be enabled
function QuickAppBase:setEnabled(enabled) end

-- Sets the device visibility
-- @param visible - Boolean indicating if device should be visible
function QuickAppBase:setVisible(visible) end

-- Sets a QuickApp variable value
-- @param name - The variable name
-- @param value - The variable value
function QuickAppBase:setVariable(name, value) end

-- Gets a QuickApp variable value
-- @param name - The variable name
-- @return The variable value or empty string if not found
function QuickAppBase:getVariable(name) end

-- Sets a value in internal storage
-- @param key - The storage key
-- @param val - The value to store
-- @param hidden - Boolean indicating if the variable should be hidden
-- @return HTTP status code
function QuickAppBase:internalStorageSet(key, val, hidden) end

-- Gets a value from internal storage
-- @param key - The storage key (optional, if nil returns all variables)
-- @return The stored value or nil if not found
function QuickAppBase:internalStorageGet(key) end

-- Removes a variable from internal storage
-- @param key - The storage key to remove
-- @return Result of the delete operation
function QuickAppBase:internalStorageRemove(key) end

-- Clears all variables from internal storage
-- @return Result of the delete operation
function QuickAppBase:internalStorageClear() end

class 'QuickApp'(QuickAppBase)
-- Constructor for QuickApp class (main QuickApp instance)
-- @param dev - Device object containing device properties and metadata
function QuickApp:__init(dev) end

-- Initializes child devices for this QuickApp
-- @param map - Optional mapping table of device types to constructor functions
---@diagnostic disable-next-line: duplicate-set-field
function QuickApp:initChildDevices(map) end

-- Creates a new child device for this QuickApp
-- @param options - Options table containing device configuration
-- @param classRepresentation - Optional class constructor for the child device
-- @return The created child device instance
function QuickApp:createChildDevice(options, classRepresentation) end

class 'QuickAppChild'(QuickAppBase)
-- Constructor for QuickAppChild class (child device of a QuickApp)
-- @param dev - Device object containing device properties and metadata
function QuickAppChild:__init(dev) end

-- Global handler for device actions
-- Routes actions to the appropriate QuickApp or child device
-- @param id - Device ID where the action was called
-- @param event - Event object containing action details
function onAction(id,event) end

-- Global handler for UI events
-- Routes UI events to the appropriate QuickApp callbacks
-- @param id - Device ID where the UI event occurred
-- @param event - Event object containing UI event details
function onUIEvent(id, event) end

-- Programmatically triggers a UI action for testing purposes
-- @param eventType - The type of UI event to trigger
-- @param elementName - The name of the UI element
-- @param arg - Optional argument value for the event
function QuickAppBase:UIAction(eventType, elementName, arg) end

class 'RefreshStateSubscriber'

-- Constructor for RefreshStateSubscriber class
-- Initializes the subscriber for refresh state events
function RefreshStateSubscriber:__init() end

-- Subscribes to refresh state events with a filter and handler
-- @param filter - Function to filter events (return true to handle)
-- @param handler - Function to handle matching events
-- @return Subscription object
function RefreshStateSubscriber:subscribe(filter, handler) end

-- Unsubscribes from refresh state events
-- @param subscription - The subscription object to remove
function RefreshStateSubscriber:unsubscribe(subscription) end

-- Starts the refresh state subscriber
function RefreshStateSubscriber:run() end

-- Stops the refresh state subscriber
function RefreshStateSubscriber:stop() end
