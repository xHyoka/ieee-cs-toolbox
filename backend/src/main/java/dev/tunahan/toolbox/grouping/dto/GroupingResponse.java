package dev.tunahan.toolbox.grouping.dto;

import dev.tunahan.toolbox.grouping.Grouping;

import java.util.List;

public record GroupingResponse( String id,
                                String title,
                                int groupSize,
                                List<List<String>> groups) {

    public static GroupingResponse from(Grouping grouping){
        return new GroupingResponse(grouping.getId(),
                grouping.getTitle(),
                grouping.getGroupSize(),
                grouping.getGroups()
        );
    }
}
