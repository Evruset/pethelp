class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.bootstrapAccessToken,
  });

  final String apiBaseUrl;
  final String? bootstrapAccessToken;

  factory AppConfig.fromEnvironment() {
    const apiBaseUrl = String.fromEnvironment(
      'VETHELP_API_BASE_URL',
      defaultValue: 'http://10.0.2.2:3000',
    );
    const token = String.fromEnvironment('VETHELP_DEV_ACCESS_TOKEN');
    return AppConfig(
      apiBaseUrl: apiBaseUrl,
      bootstrapAccessToken: token.isEmpty ? null : token,
    );
  }
}
