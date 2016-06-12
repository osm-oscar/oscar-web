#ifndef OSCAR_WEB_HELPERS_H
#define OSCAR_WEB_HELPERS_H
#include <cppcms/json.h>
#include <string>
#include <functional>
#include <type_traits>
#include <limits>

namespace oscar_web {

template<typename TType>
std::vector<TType> parseJsonArray(const std::string & str, bool & ok);

}//end namespace oscar_web

//definition
namespace oscar_web {
namespace detail {

	template<typename TType, typename TEnable = void>
	struct JsonTypeFromType;
	
	template<typename TType>
	struct JsonTypeFromType<TType,
		typename std::enable_if<
			std::numeric_limits<TType>::is_integer && !std::is_same<TType, bool>::value
		>::type
	> {
		static constexpr cppcms::json::json_type value = cppcms::json::is_number;
	};

	template<typename TType>
	struct JsonTypeFromType<TType,
		typename std::enable_if<
			std::is_same<TType, bool>::value
		>::type
	> {
		static constexpr cppcms::json::json_type value = cppcms::json::is_boolean;
	};
	
	template<typename TType>
	struct JsonTypeFromType<TType,
		typename std::enable_if<
			std::is_same<TType, std::string>::value
		>::type
	> {
		static constexpr cppcms::json::json_type value = cppcms::json::is_string;
	};
}

template<typename T_Type>
std::vector<T_Type> parseJsonArray(const std::string& str, bool & ok) {
	ok = true;
	
	std::stringstream ss;
	std::vector<T_Type> result;
	ss << str;
	cppcms::json::value jsonData;
	jsonData.load(ss, true);
	
	if (jsonData.type() == cppcms::json::is_array) {
		cppcms::json::array & arr = jsonData.array();
		for(const cppcms::json::value & v : arr) {
			try {
				result.emplace_back( v.get_value<T_Type>() );
			}
			catch(const cppcms::json::bad_value_cast & err) {
				ok = false;
			}
		}
	}
	else {
		ok = false;
	}
	return result;
}

}

#endif