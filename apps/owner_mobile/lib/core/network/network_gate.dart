import 'package:connectivity_plus/connectivity_plus.dart';

import '../api/api_client.dart';

enum NetworkGateState { online, offline, uncertain }

class NetworkGate {
  NetworkGate(this._connectivity, this._apiClient);

  final Connectivity _connectivity;
  final ApiClient _apiClient;

  Future<NetworkGateState> check() async {
    final connectivity = await _connectivity.checkConnectivity();
    if (connectivity.contains(ConnectivityResult.none)) {
      return NetworkGateState.offline;
    }
    return await _apiClient.healthCheck()
        ? NetworkGateState.online
        : NetworkGateState.uncertain;
  }
}
