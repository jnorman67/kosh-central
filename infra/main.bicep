@description('Base name for all resources')
param appName string = 'kosh-central'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('App Service Plan SKU')
@allowed(['F1', 'B1', 'B2', 'S1'])
param skuName string = 'F1'

@description('Azure AD Application (client) ID for MSAL authentication')
@secure()
param azureClientId string

var appServicePlanName = '${appName}-plan'
var webAppName = appName

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: skuName
  }
  properties: {
    reserved: true // required for Linux
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      appCommandLine: 'node packages/server/dist/index.js'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: azureClientId
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
      ]
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
}

output webAppName string = webApp.name
output webAppHostName string = webApp.properties.defaultHostName
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
