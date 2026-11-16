package dev.tunahan.toolbox.grouping;

import dev.tunahan.toolbox.grouping.dto.CreateGroupingRequest;
import dev.tunahan.toolbox.grouping.dto.GroupingResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/groupings")
@RequiredArgsConstructor
public class GroupingController {
    private final GroupingService service;


    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupingResponse create(@Valid @RequestBody CreateGroupingRequest request) {
        return service.create(request);

    }

    @GetMapping("/{id}")
    public GroupingResponse get(@PathVariable String id) {
        return service.get(id);
    }
}
