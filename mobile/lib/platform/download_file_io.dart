import 'dart:io';
import 'dart:typed_data';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

Future<String> saveDownload(Uint8List bytes, String name, String id) async {
  final directory = await getApplicationDocumentsDirectory();
  final local = File('${directory.path}/${id}_$name');
  await local.writeAsBytes(bytes, flush: true);
  final result = await OpenFilex.open(local.path);
  return result.type == ResultType.done
      ? 'Downloaded and opened $name'
      : 'Saved to app documents. Install an app that can open this file type.';
}
