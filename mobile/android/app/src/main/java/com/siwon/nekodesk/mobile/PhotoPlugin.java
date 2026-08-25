package com.siwon.nekodesk.mobile;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 찍은 사진을 폰 갤러리에 저장한다.
 *
 * 웹뷰에서 `<a download>` 로는 안드로이드 갤러리에 아무것도 남지 않아서,
 * 캔버스 그림을 base64로 받아 여기서 직접 저장한다.
 *
 * 안드로이드 10부터는 MediaStore에 넣기만 하면 권한 없이 갤러리에 뜬다.
 * 그 이전 버전만 저장 권한이 필요하다.
 */
@CapacitorPlugin(
    name = "NekoPhoto",
    permissions = {
        @Permission(alias = "photos", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class PhotoPlugin extends Plugin {

    private static final String ALBUM = "NEKO DESK";

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && getPermissionState("photos") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("photos", call, "permsCallback");
            return;
        }
        doSave(call);
    }

    @PermissionCallback
    private void permsCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && getPermissionState("photos") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("사진 저장 권한이 필요합니다");
            return;
        }
        doSave(call);
    }

    private void doSave(PluginCall call) {
        String data = call.getString("data", "");
        String name = call.getString("name", "neko-photo.png");
        if (data == null || data.length() == 0) {
            call.reject("저장할 그림이 없습니다");
            return;
        }
        // "data:image/png;base64,...." 형태로 와도 받아준다
        int comma = data.indexOf(',');
        if (data.startsWith("data:") && comma > 0) data = data.substring(comma + 1);

        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (Exception e) {
            call.reject("그림을 읽지 못했습니다", e);
            return;
        }

        try {
            String path = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                    ? saveViaMediaStore(bytes, name)
                    : saveLegacy(bytes, name);
            JSObject ret = new JSObject();
            ret.put("path", path);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("저장하지 못했습니다: " + e.getMessage(), e);
        }
    }

    /** 안드로이드 10+ — MediaStore에 넣으면 바로 갤러리에 뜬다 */
    private String saveViaMediaStore(byte[] bytes, String name) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        ContentValues cv = new ContentValues();
        cv.put(MediaStore.Images.Media.DISPLAY_NAME, name);
        cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + ALBUM);
        cv.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
        if (uri == null) throw new Exception("갤러리에 자리를 만들지 못했습니다");

        OutputStream os = cr.openOutputStream(uri);
        if (os == null) throw new Exception("파일을 열지 못했습니다");
        try {
            os.write(bytes);
        } finally {
            os.close();
        }

        // 다 썼다고 알려야 다른 앱에서 보인다
        cv.clear();
        cv.put(MediaStore.Images.Media.IS_PENDING, 0);
        cr.update(uri, cv, null, null);
        return Environment.DIRECTORY_PICTURES + "/" + ALBUM + "/" + name;
    }

    /** 안드로이드 9 이하 — 공용 폴더에 쓰고 갤러리에 알린다 */
    private String saveLegacy(byte[] bytes, String name) throws Exception {
        File dir = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), ALBUM);
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("폴더를 만들지 못했습니다");

        File file = new File(dir, name);
        FileOutputStream fos = new FileOutputStream(file);
        try {
            fos.write(bytes);
        } finally {
            fos.close();
        }
        MediaScannerConnection.scanFile(getContext(),
                new String[] { file.getAbsolutePath() }, new String[] { "image/png" }, null);
        return file.getAbsolutePath();
    }
}
