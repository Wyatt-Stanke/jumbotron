function gml_Script_s_get_player_ovr(_inst, _other, argument0) {
	{
		var gmlmax_rating = 0;
		var gmlrating = 0;
		var ___sw1046___ = ds_map_find_value(argument0, "position");
		var ___swc1047___ = -1;
		if (yyCompareVal(___sw1046___, 1, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 0;
		} else if (yyCompareVal(___sw1046___, 2, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 1;
		} else if (yyCompareVal(___sw1046___, 3, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 2;
		} else if (yyCompareVal(___sw1046___, 4, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 3;
		} else if (yyCompareVal(___sw1046___, 5, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 4;
		} else if (yyCompareVal(___sw1046___, 6, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 5;
		} else if (yyCompareVal(___sw1046___, 7, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 6;
		} else if (yyCompareVal(___sw1046___, 8, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 7;
		} else if (yyCompareVal(___sw1046___, 9, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 8;
		} else if (yyCompareVal(___sw1046___, 10, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 9;
		}
		switch (___swc1047___) {
			case 0: {
				gmlmax_rating = 37;
				break;
			}
			case 1: {
				gmlmax_rating = 34;
				break;
			}
			case 2: {
				gmlmax_rating = 33;
				break;
			}
			case 3: {
				gmlmax_rating = 34;
				break;
			}
			case 4: {
				gmlmax_rating = 35;
				break;
			}
			case 5: {
				gmlmax_rating = 35;
				break;
			}
			case 6: {
				gmlmax_rating = 33;
				break;
			}
			case 7: {
				gmlmax_rating = 33;
				break;
			}
			case 8: {
				gmlmax_rating = 33;
				break;
			}
			case 9: {
				gmlmax_rating = 37;
				break;
			}
		}
		var gmlstm = 0;
		var gmlspd = 0;
		var gmlstr = 0;
		var gmlskl = 0;
		if (yyGetBool(ds_map_exists(argument0, "stamina"))) {
			gmlstm = real(ds_map_find_value(argument0, "stamina"));
		}
		if (yyGetBool(ds_map_exists(argument0, "speed"))) {
			gmlspd = real(ds_map_find_value(argument0, "speed"));
		}
		if (yyGetBool(ds_map_exists(argument0, "strength"))) {
			gmlstr = real(ds_map_find_value(argument0, "strength"));
		}
		if (yyGetBool(ds_map_exists(argument0, "skill"))) {
			gmlskl = real(ds_map_find_value(argument0, "skill"));
		}
		gmlrating = yyfplus(
			yyfplus(
				yyfplus(__yy_gml_errCheck(gmlstm), __yy_gml_errCheck(gmlspd)),
				__yy_gml_errCheck(gmlstr),
			),
			__yy_gml_errCheck(gmlskl),
		);
		gmlrating = round(
			yyfplus(
				yyftime(
					75,
					yyfdivide(
						__yy_gml_errCheck(
							yyftime(
								__yy_gml_errCheck(
									yyfdivide(
										__yy_gml_errCheck(gmlrating),
										__yy_gml_errCheck(gmlmax_rating),
									),
								),
								100,
							),
						),
						100,
					),
				),
				25,
			),
		);
		return gmlrating;
	}
}
