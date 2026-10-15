import 'dart:async';
import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'platform/download_file.dart';

typedef Json = Map<String, dynamic>;

class ApiError implements Exception {
  final String message;
  final int? status;
  ApiError(this.message, [this.status]);
  @override
  String toString() => message;
}

class LmsApi extends ChangeNotifier {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: kIsWeb
        ? 'http://localhost:8000/api'
        : 'http://10.0.2.2:8000/api',
  );
  final FlutterSecureStorage storage;
  final http.Client client;
  String? _token;
  Json? user;
  LmsApi({FlutterSecureStorage? storage, http.Client? client})
    : storage = storage ?? const FlutterSecureStorage(),
      client = client ?? http.Client();

  Map<String, String> get headers => {
    if (_token != null) 'Authorization': 'Bearer $_token',
  };
  Future<void> restore() async {
    _token = await storage.read(key: 'lms_token');
    if (_token == null) return;
    final data = await get('/auth/me');
    user = Map<String, dynamic>.from(data['user']);
    if (user!['role'] != 'student') {
      await clear();
      throw ApiError('The mobile app is available to students only.');
    }
    notifyListeners();
  }

  Future<void> clear() async {
    _token = null;
    user = null;
    await storage.delete(key: 'lms_token');
    notifyListeners();
  }

  Future<void> authenticate(Json values, {bool register = false}) async {
    final data = await send(
      'POST',
      '/mobile/auth/${register ? 'register' : 'login'}',
      {...values, if (register) 'role': 'student'},
    );
    if (data['user']['role'] != 'student') {
      throw ApiError('Only students can use the mobile app.');
    }
    _token = data['token'];
    await storage.write(key: 'lms_token', value: _token);
    user = Map<String, dynamic>.from(data['user']);
    notifyListeners();
  }

  Future<void> logout() async {
    await send('POST', '/auth/logout');
    await clear();
  }

  Future<dynamic> get(String path) => send('GET', path);
  Future<dynamic> send(String method, String path, [Json? body]) async {
    try {
      final request = http.Request(method, Uri.parse('$baseUrl$path'));
      request.headers.addAll({...headers, 'Content-Type': 'application/json'});
      if (body != null) request.body = jsonEncode(body);
      final streamed = await client
          .send(request)
          .timeout(const Duration(seconds: 30));
      final response = await http.Response.fromStream(
        streamed,
      ).timeout(const Duration(seconds: 30));
      return await _decode(response);
    } on TimeoutException {
      throw ApiError('The server took too long to respond. Please try again.');
    } on http.ClientException {
      throw ApiError('Unable to connect to the server. Please try again.');
    } on FormatException {
      throw ApiError('The server returned an unexpected response.');
    }
  }

  Future<dynamic> _decode(http.Response response) async {
    final data = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body);
    if (response.statusCode == 401 && _token != null) {
      await clear();
      throw ApiError('Your session has expired. Please sign in again.', 401);
    }
    if (response.statusCode >= 400) {
      throw ApiError(
        data['message'] ?? 'Request failed. Please try again.',
        response.statusCode,
      );
    }
    return data;
  }

  Future<void> updateProfile(Json values) async {
    final data = await send('PATCH', '/auth/profile', values);
    user = Map<String, dynamic>.from(data['user']);
    notifyListeners();
  }

  Future<void> changePassword(Json values) async {
    final data = await send('PATCH', '/auth/password', values);
    _token = data['token'];
    await storage.write(key: 'lms_token', value: _token);
  }

  Future<void> submit(
    String assignmentId,
    String text,
    PlatformFile? file,
  ) async {
    if (file != null && file.size > 3 * 1024 * 1024) {
      throw ApiError('Maximum attachment size is 3 MB.');
    }
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/assignments/$assignmentId/submit'),
      );
      request.headers.addAll(headers);
      request.fields['text'] = text;
      if (file != null) {
        if (file.bytes != null) {
          request.files.add(
            http.MultipartFile.fromBytes(
              'file',
              file.bytes!,
              filename: file.name,
            ),
          );
        } else if (file.readStream != null) {
          request.files.add(
            http.MultipartFile(
              'file',
              file.readStream!,
              file.size,
              filename: file.name,
            ),
          );
        } else if (!kIsWeb && file.path != null) {
          request.files.add(
            await http.MultipartFile.fromPath(
              'file',
              file.path!,
              filename: file.name,
            ),
          );
        } else {
          throw ApiError('This file cannot be opened. Select another file.');
        }
      }
      final stream = await client
          .send(request)
          .timeout(const Duration(minutes: 2));
      await _decode(
        await http.Response.fromStream(
          stream,
        ).timeout(const Duration(minutes: 2)),
      );
    } on TimeoutException {
      throw ApiError('Upload timed out. Check your connection and try again.');
    } on http.ClientException {
      throw ApiError('Upload interrupted. Please try again.');
    }
  }

  Future<String> download(Json file) async {
    try {
      final response = await client
          .get(Uri.parse('$baseUrl/files/${file['id']}'), headers: headers)
          .timeout(const Duration(minutes: 2));
      if (response.statusCode >= 400) {
        await _decode(response);
      }
      final name = (file['name'] as String).replaceAll(
        RegExp(r'[^a-zA-Z0-9._ -]'),
        '_',
      );
      return await saveDownload(
        response.bodyBytes,
        name,
        file['id'].toString(),
      );
    } on TimeoutException {
      throw ApiError('Download timed out. Please try again.');
    } on http.ClientException {
      throw ApiError('Download interrupted. Please try again.');
    }
  }

  @override
  void dispose() {
    client.close();
    super.dispose();
  }
}
